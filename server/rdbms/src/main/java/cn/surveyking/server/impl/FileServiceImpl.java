package cn.surveyking.server.impl;

import cn.surveyking.server.core.constant.AppConsts;
import cn.surveyking.server.core.constant.ErrorCode;
import cn.surveyking.server.core.constant.LocalStorageNameStrategyEnum;
import cn.surveyking.server.core.constant.LocalStoragePathStrategyEnum;
import cn.surveyking.server.core.constant.StorageTypeEnum;
import cn.surveyking.server.core.exception.ErrorCodeException;
import cn.surveyking.server.core.uitls.*;
import cn.surveyking.server.domain.dto.*;
import cn.surveyking.server.domain.mapper.FileViewMapper;
import cn.surveyking.server.domain.model.File;
import cn.surveyking.server.mapper.FileMapper;
import cn.surveyking.server.service.FileService;
import cn.surveyking.server.service.ProjectService;
import cn.surveyking.server.service.SurveyService;
import cn.surveyking.server.storage.StorageProperties;
import cn.surveyking.server.storage.StorageService;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;

import static cn.surveyking.server.core.constant.ErrorCode.FileUploadError;

/**
 * @author javahuang
 * @date 2021/9/10
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class FileServiceImpl extends ServiceImpl<FileMapper, File> implements FileService {

	private static final Set<String> SAFE_INLINE_EXTENSIONS = Collections
			.unmodifiableSet(new HashSet<>(Arrays.asList("jpg", "jpeg", "png", "gif", "bmp", "wbmp", "webp", "pdf",
					"txt", "csv", "mp3", "wav", "aac", "ogg", "mp4", "webm")));

	private static final Set<SurveySchema.QuestionType> PUBLIC_UPLOAD_TYPES = Collections
			.unmodifiableSet(EnumSet.of(SurveySchema.QuestionType.Upload, SurveySchema.QuestionType.Signature,
					SurveySchema.QuestionType.RichText, SurveySchema.QuestionType.Barcode));

	private static final int DEFAULT_MAX_FILE_COUNT = 20;

	private final StorageService storageService;

	private final FileViewMapper fileViewMapper;

	private final StorageProperties storageProperties;

	private final AtomicLong seq = new AtomicLong(System.currentTimeMillis());

	private final ConcurrentMap<String, UploadRateWindow> publicUploadRateWindows = new ConcurrentHashMap<>();

	@Autowired
	@Lazy
	private ProjectService projectService;

	@Autowired
	@Lazy
	private SurveyService surveyService;

	@Override
	@CacheEvict(cacheNames = "fileCache", allEntries = true)
	public void deleteFile(String id) {
		File file = getById(id);
		if (file == null) {
			return;
		}
		assertCurrentUserOwnsFile(file);
		deletePhysicalFileIfUnreferenced(file.getId(), file.getFilePath());
		deletePhysicalFileIfUnreferenced(file.getId(), file.getThumbFilePath());
		removeById(id);
	}

	private void deletePhysicalFileIfUnreferenced(String fileId, String filePath) {
		if (StringUtils.isBlank(filePath)) {
			return;
		}
		long references = count(Wrappers.<File>lambdaQuery().ne(File::getId, fileId)
				.and(wrapper -> wrapper.eq(File::getFilePath, filePath).or().eq(File::getThumbFilePath, filePath)));
		if (references == 0) {
			storageService.deleteFile(filePath);
		}
	}

	@Override
	public FileView upload(UploadFileRequest request) {
		MultipartFile uploadFile = request.getFile();
		if (uploadFile == null || uploadFile.isEmpty()) {
			throw new ErrorCodeException(FileUploadError);
		}
		String originalName = validateOriginalFilename(uploadFile.getOriginalFilename());
		String extName = StringUtils.substringAfterLast(originalName, ".");
		String fileId = NanoIdUtils.randomNanoId();
		SurveySchema uploadSchema = null;

		// 通过问卷页面上传需要校验题型、文件类型、大小、频率和项目容量
		if (Boolean.TRUE.equals(request.getPublicUpload())) {
			if (StringUtils.isEmpty(request.getProjectId()) || StringUtils.isEmpty(request.getQuestionId())) {
				throw new ErrorCodeException(FileUploadError);
			}
			ProjectView projectView = projectService.getProject(request.getProjectId());
			// 校验对应项目状态
			surveyService.validateProject(projectView);

			uploadSchema = SchemaHelper.flatSurveySchema(projectView.getSurvey()).stream()
					.filter(x -> x.getId().equals(request.getQuestionId())).findFirst()
					.orElseThrow(() -> new ErrorCodeException(FileUploadError));
			if (!PUBLIC_UPLOAD_TYPES.contains(uploadSchema.getType())) {
				throw new ErrorCodeException(FileUploadError);
			}
			SurveySchema.Attribute attribute = getUploadAttribute(uploadSchema);
			String fileAccept = attribute.getFileAccept();
			if (StringUtils.isNotEmpty(fileAccept)) {
				// 只允许上传指定格式的文件
				boolean notAllowExtension = Arrays.stream(fileAccept.split(","))
						.map(type -> type.trim().replaceFirst("\\.", ""))
						.noneMatch(type -> type.equalsIgnoreCase(extName));
				if (notAllowExtension) {
					throw new ErrorCodeException(FileUploadError);
				}
			}
			else {
				// 默认文件类型白名单限制
				boolean notAllowExtension = Arrays.stream(FileUtils.ALLOWED_EXTENSIONS)
						.noneMatch(ext -> ext.equalsIgnoreCase(extName));
				if (notAllowExtension) {
					throw new ErrorCodeException(FileUploadError);
				}
			}

			if ((SurveySchema.QuestionType.Signature.equals(uploadSchema.getType())
					|| SurveySchema.QuestionType.RichText.equals(uploadSchema.getType())
					|| SurveySchema.QuestionType.Barcode.equals(uploadSchema.getType()))
					&& !isSupportImage(originalName)) {
				throw new ErrorCodeException(FileUploadError);
			}
			long configuredLimit = toBytes(attribute.getMaxFileSize(), storageProperties.getMaxPublicFileSizeMb());
			if (uploadFile.getSize() <= 0 || uploadFile.getSize() > configuredLimit) {
				throw new ErrorCodeException(ErrorCode.FileSizeExceeded);
			}
			assertPublicUploadRate(request.getProjectId());
			assertProjectStorageQuota(request.getProjectId(), uploadFile.getSize());
			if (SurveySchema.QuestionType.Barcode.equals(uploadSchema.getType())) {
				request.setFileType(AppConsts.FileType.BARCODE);
			}
			else if (SurveySchema.QuestionType.RichText.equals(uploadSchema.getType())) {
				request.setFileType(AppConsts.FileType.QUESTION_IMAGE);
			}
			else {
				request.setFileType(StorageTypeEnum.ANSWER_ATTACHMENT.getType());
			}
		}
		else if (Boolean.TRUE.equals(request.getPublicRead()) && !isSupportImage(originalName)) {
			throw new ErrorCodeException(FileUploadError);
		}

		if (isSupportImage(originalName)) {
			assertImageDimensions(uploadFile);
		}

		String fileName = getFileNameByStrategy(originalName);
		String filePath = Boolean.TRUE.equals(request.getPublicUpload())
				? buildPublicFilePath(request, fileId, fileName) : getFilePathByStrategy(request, fileId, fileName);
		File file = new File();
		file.setId(fileId);
		file.setStorageType(request.getFileType());
		file.setOriginalName(originalName);
		file.setFileName(fileName);
		file.setFilePath(filePath);
		boolean publicRead = Boolean.TRUE.equals(request.getPublicUpload())
				? SurveySchema.QuestionType.RichText.equals(uploadSchema.getType())
				: Boolean.TRUE.equals(request.getPublicRead());
		file.setShared(publicRead ? 1 : 0);
		file.setProjectId(Boolean.TRUE.equals(request.getPublicUpload()) ? request.getProjectId() : null);
		file.setQuestionId(Boolean.TRUE.equals(request.getPublicUpload()) ? request.getQuestionId() : null);
		file.setFileSize(uploadFile.getSize());

		String barcodeContent = null;
		String thumbImagePath = null;
		try {
			if (AppConsts.FileType.BARCODE == request.getFileType()) {
				barcodeContent = BarcodeReader.readBarcode(uploadFile.getInputStream());
			}
			if (isSupportImage(originalName)) {
				thumbImagePath = storageService.getThumbImageFilePath(filePath);
				try (InputStream inputStream = uploadFile.getInputStream()) {
					storageService.uploadFile(storageService.generateThumbImage(inputStream), thumbImagePath);
					file.setThumbFilePath(thumbImagePath);
				}
			}
			storageService.uploadFile(uploadFile.getInputStream(), filePath);
			save(file);
			FileView fileView = fileViewMapper.toView(file);
			fileView.setQuestionId(file.getQuestionId());
			fileView.setContent(barcodeContent);
			return fileView;
		}
		catch (Exception e) {
			storageService.deleteFile(filePath);
			storageService.deleteFile(thumbImagePath);
			if (e instanceof RuntimeException) {
				throw (RuntimeException) e;
			}
			throw new ErrorCodeException(FileUploadError);
		}
	}

	/**
	 * 根据存储配置，按照指定规则生成相应的文件名
	 * @param originalName 原文件名
	 * @return 文件名
	 */
	private String getFileNameByStrategy(String originalName) {
		String strategy = storageProperties.getLocal().getNameStrategy();
		int idx = originalName.lastIndexOf('.');
		if (idx <= 0 || idx == originalName.length() - 1) {
			throw new ErrorCodeException(FileUploadError);
		}
		String fileType = originalName.substring(idx);
		if (LocalStorageNameStrategyEnum.SEQ_ADN_ORIGINAL_NAME.getStrategy().equals(strategy)) {
			return seq.incrementAndGet() + "_" + originalName;
		}
		else if (LocalStorageNameStrategyEnum.ORIGINAL_NAME_AND_SEQ.getStrategy().equals(strategy)) {
			return originalName.substring(0, idx) + "_" + seq.incrementAndGet() + fileType;
		}
		else if (LocalStorageNameStrategyEnum.SEQ.getStrategy().equals(strategy)) {
			return seq.incrementAndGet() + fileType;
		}
		else {
			return UUID.randomUUID().toString().replace("-", "") + fileType;
		}
	}

	/**
	 * 根据本地存储配置，生成不同方式的文件保存路径
	 * @param request 文件上传请求
	 * @param fileName 文件名
	 * @return 文件保存路径
	 */
	private String getFilePathByStrategy(UploadFileRequest request, String fileId, String fileName) {
		String strategy = storageProperties.getLocal().getPathStrategy();
		if (LocalStoragePathStrategyEnum.BY_ID.getStrategy().equals(strategy)) {
			String basePath = sanitizeBasePath(request.getBasePath());
			return (StringUtils.isBlank(basePath) ? "" : basePath + java.io.File.separator) + fileId
					+ java.io.File.separator + fileName;
		}
		else if (LocalStoragePathStrategyEnum.BY_DATE.getStrategy().equals(strategy)) {
			String dateFormat = storageProperties.getLocal().getDateFormat();
			DateTimeFormatter dateTimeFormatter = DateTimeFormatter.ofPattern(dateFormat);
			LocalDate now = LocalDate.now();
			dateFormat = now.format(dateTimeFormatter).replace("/", java.io.File.separator).replace("\\",
					java.io.File.separator);
			return dateFormat + java.io.File.separator + fileId + java.io.File.separator + fileName;
		}
		else {
			return fileId + java.io.File.separator + fileName;
		}
	}

	private String buildPublicFilePath(UploadFileRequest request, String fileId, String fileName) {
		return String.join(java.io.File.separator, "public", safePathSegment(request.getProjectId()),
				safePathSegment(request.getQuestionId()), fileId, fileName);
	}

	private String validateOriginalFilename(String originalName) {
		if (StringUtils.isBlank(originalName) || originalName.length() > 255 || ".".equals(originalName)
				|| "..".equals(originalName) || originalName.indexOf('/') >= 0 || originalName.indexOf('\\') >= 0
				|| originalName.chars().anyMatch(ch -> ch == 0 || ch < 0x20 || ch == 0x7f)) {
			throw new ErrorCodeException(FileUploadError);
		}
		return originalName;
	}

	private String sanitizeBasePath(String basePath) {
		if (StringUtils.isBlank(basePath)) {
			return null;
		}
		if (basePath.length() > 256 || basePath.startsWith("/") || basePath.startsWith("\\")) {
			throw new ErrorCodeException(FileUploadError);
		}
		return Arrays.stream(basePath.replace('\\', '/').split("/", -1)).map(this::safePathSegment)
				.collect(java.util.stream.Collectors.joining(java.io.File.separator));
	}

	private String safePathSegment(String value) {
		if (StringUtils.isBlank(value) || !value.matches("[a-zA-Z0-9_-]{1,128}")) {
			throw new ErrorCodeException(FileUploadError);
		}
		return value;
	}

	private SurveySchema.Attribute getUploadAttribute(SurveySchema schema) {
		if (!CollectionUtils.isEmpty(schema.getChildren()) && schema.getChildren().get(0).getAttribute() != null) {
			return schema.getChildren().get(0).getAttribute();
		}
		return Optional.ofNullable(schema.getAttribute()).orElseGet(SurveySchema.Attribute::new);
	}

	private long toBytes(Double questionLimitMb, long defaultLimitMb) {
		double limitMb = questionLimitMb != null && questionLimitMb > 0 ? Math.min(questionLimitMb, defaultLimitMb)
				: defaultLimitMb;
		return Math.max(1L, (long) (limitMb * 1024 * 1024));
	}

	private void assertProjectStorageQuota(String projectId, long newFileSize) {
		long quota = megabytesToBytes(storageProperties.getMaxProjectStorageMb());
		Long currentSize = getBaseMapper().selectTotalSizeByProjectId(projectId);
		if (exceedsQuota(Optional.ofNullable(currentSize).orElse(0L), newFileSize, quota)) {
			throw new ErrorCodeException(ErrorCode.FileStorageQuotaExceeded);
		}
		long totalQuota = megabytesToBytes(storageProperties.getMaxTotalPublicStorageMb());
		Long totalSize = getBaseMapper().selectTotalPublicSize();
		if (exceedsQuota(Optional.ofNullable(totalSize).orElse(0L), newFileSize, totalQuota)) {
			throw new ErrorCodeException(ErrorCode.FileStorageQuotaExceeded);
		}
	}

	private boolean exceedsQuota(long currentSize, long newFileSize, long quota) {
		return quota > 0 && (newFileSize > quota || currentSize > quota - newFileSize);
	}

	private long megabytesToBytes(long megabytes) {
		if (megabytes <= 0) {
			return 0;
		}
		try {
			return Math.multiplyExact(megabytes, 1024L * 1024L);
		}
		catch (ArithmeticException e) {
			return Long.MAX_VALUE;
		}
	}

	private void assertPublicUploadRate(String projectId) {
		long now = System.currentTimeMillis();
		HttpServletRequest httpRequest = ContextHelper.getCurrentHttpRequest();
		String remoteAddress = httpRequest == null ? "unknown" : httpRequest.getRemoteAddr();
		if (!acquireRateLimit("client:" + remoteAddress, storageProperties.getMaxPublicUploadsPerMinute(), now)
				|| !acquireRateLimit("project:" + projectId, storageProperties.getMaxPublicUploadsPerProjectPerMinute(),
						now)) {
			throw new ErrorCodeException(ErrorCode.FileUploadRateExceeded);
		}
		if (publicUploadRateWindows.size() > 10000) {
			publicUploadRateWindows.entrySet().removeIf(entry -> entry.getValue().isExpired(now));
		}
	}

	private boolean acquireRateLimit(String key, int limit, long now) {
		if (limit <= 0) {
			return true;
		}
		return publicUploadRateWindows.computeIfAbsent(key, ignored -> new UploadRateWindow(now)).tryAcquire(limit,
				now);
	}

	private void assertImageDimensions(MultipartFile uploadFile) {
		try (InputStream inputStream = uploadFile.getInputStream();
				ImageInputStream imageInputStream = ImageIO.createImageInputStream(inputStream)) {
			if (imageInputStream == null) {
				throw new ErrorCodeException(FileUploadError);
			}
			Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInputStream);
			if (!readers.hasNext()) {
				throw new ErrorCodeException(FileUploadError);
			}
			ImageReader reader = readers.next();
			try {
				reader.setInput(imageInputStream, true, true);
				long pixels = Math.multiplyExact((long) reader.getWidth(0), (long) reader.getHeight(0));
				if (pixels <= 0 || pixels > storageProperties.getMaxImagePixels()) {
					throw new ErrorCodeException(FileUploadError);
				}
			}
			finally {
				reader.dispose();
			}
		}
		catch (ArithmeticException | IOException e) {
			throw new ErrorCodeException(FileUploadError);
		}
	}

	@Override
	public List<FileView> listFiles(FileQuery query) {
		List<File> files = list(
				Wrappers.<File>lambdaQuery().eq(query.getType() != null, File::getStorageType, query.getType())
						// 默认只能查询自己的
						.eq(CollectionUtils.isEmpty(query.getIds()), File::getCreateBy,
								SecurityContextUtils.getUserId())
						// 可以根据 ids 查询已知文件
						.in(!CollectionUtils.isEmpty(query.getIds()), File::getId, query.getIds()));
		if (StringUtils.isNotBlank(query.getProjectId())) {
			files.removeIf(file -> StringUtils.isNotBlank(file.getProjectId())
					&& !query.getProjectId().equals(file.getProjectId()));
		}
		if (StringUtils.isNotBlank(query.getQuestionId())) {
			files.removeIf(file -> StringUtils.isNotBlank(file.getQuestionId())
					&& !query.getQuestionId().equals(file.getQuestionId()));
		}
		Map<String, File> filesById = files.stream()
				.collect(java.util.stream.Collectors.toMap(File::getId, file -> file));
		List<FileView> result = fileViewMapper.toView(files);
		result.forEach(view -> {
			File file = filesById.get(view.getId());
			view.setQuestionId(
					StringUtils.isNotBlank(file.getQuestionId()) ? file.getQuestionId() : query.getQuestionId());
		});
		return result;
	}

	@Override
	@CacheEvict(cacheNames = "fileCache", allEntries = true)
	public void validateAndBindAnswerFiles(String projectId, String answerId, SurveySchema survey,
			LinkedHashMap<String, Object> answer, LinkedHashMap<String, Object> previousAnswer) {
		if (survey == null || answer == null || StringUtils.isBlank(projectId) || StringUtils.isBlank(answerId)) {
			return;
		}
		SchemaHelper.flatSurveySchema(survey).stream()
				.filter(schema -> SurveySchema.QuestionType.Upload.equals(schema.getType())
						|| SurveySchema.QuestionType.Signature.equals(schema.getType()))
				.forEach(schema -> validateAndBindQuestionFiles(projectId, answerId, schema, answer, previousAnswer));
	}

	private void validateAndBindQuestionFiles(String projectId, String answerId, SurveySchema schema,
			LinkedHashMap<String, Object> answer, LinkedHashMap<String, Object> previousAnswer) {
		List<String> fileIds = extractFileIds(answer.get(schema.getId()));
		if (fileIds.isEmpty()) {
			return;
		}
		int maxFileCount = Optional.ofNullable(getUploadAttribute(schema).getMaxFileCount()).filter(count -> count > 0)
				.orElse(DEFAULT_MAX_FILE_COUNT);
		if (fileIds.size() > maxFileCount) {
			throw new ErrorCodeException(ErrorCode.FileReferenceInvalid);
		}
		Set<String> distinctIds = new LinkedHashSet<>(fileIds);
		List<File> files = listByIds(distinctIds);
		if (files.size() != distinctIds.size()) {
			throw new ErrorCodeException(ErrorCode.FileReferenceInvalid);
		}
		Set<String> previousIds = new HashSet<>(
				extractFileIds(previousAnswer == null ? null : previousAnswer.get(schema.getId())));
		for (File file : files) {
			boolean currentContext = projectId.equals(file.getProjectId())
					&& schema.getId().equals(file.getQuestionId());
			boolean migratableLegacyFile = StringUtils.isBlank(file.getProjectId())
					&& StringUtils.isBlank(file.getQuestionId()) && previousIds.contains(file.getId());
			if ((!currentContext && !migratableLegacyFile)
					|| !Objects.equals(file.getStorageType(), StorageTypeEnum.ANSWER_ATTACHMENT.getType())
					|| (StringUtils.isNotBlank(file.getAnswerId()) && !answerId.equals(file.getAnswerId()))) {
				throw new ErrorCodeException(ErrorCode.FileReferenceInvalid);
			}
			File update = new File().setProjectId(projectId).setQuestionId(schema.getId()).setAnswerId(answerId);
			boolean updated = update(update, Wrappers.<File>lambdaUpdate().eq(File::getId, file.getId())
					.and(wrapper -> wrapper.isNull(File::getAnswerId).or().eq(File::getAnswerId, answerId)));
			if (!updated) {
				throw new ErrorCodeException(ErrorCode.FileReferenceInvalid);
			}
		}
	}

	private List<String> extractFileIds(Object questionValue) {
		if (!(questionValue instanceof Map)) {
			return Collections.emptyList();
		}
		List<String> result = new ArrayList<>();
		((Map<?, ?>) questionValue).values().forEach(value -> {
			if (value instanceof Collection) {
				((Collection<?>) value).stream().filter(Objects::nonNull).map(Object::toString).forEach(result::add);
			}
			else if (value != null) {
				result.add(value.toString());
			}
		});
		return result;
	}

	@Override
	@SneakyThrows
	public ResponseEntity<Resource> loadFile(FileQuery query) {
		File file = getFileByQuery(query);
		return buildFileResponse(query, file);
	}

	@Override
	@SneakyThrows
	public ResponseEntity<Resource> loadPublicFile(FileQuery query) {
		File file = getFileByQuery(query);
		if (!Objects.equals(file.getShared(), 1)) {
			throw new AccessDeniedException("无权限访问该文件");
		}
		return buildFileResponse(query, file);
	}

	@Override
	@SneakyThrows
	public ResponseEntity<Resource> loadUserFile(FileQuery query) {
		File file = getFileByQuery(query);
		assertReadableFile(file);
		return buildFileResponse(query, file);
	}

	private File getFileByQuery(FileQuery query) {
		if (query == null || StringUtils.isBlank(query.getId())) {
			throw new ErrorCodeException(ErrorCode.FileNotExists);
		}
		String fileId = query.getId();
		if (fileId.contains("@")) {
			fileId = fileId.substring(0, fileId.lastIndexOf("@"));
		}
		File file = getById(fileId);
		if (file == null) {
			log.error("未找到对应的文件 {}", fileId);
			throw new ErrorCodeException(ErrorCode.FileNotExists);
		}
		return file;
	}

	private void assertCurrentUserOwnsFile(File file) {
		if (Objects.equals(file.getCreateBy(), SecurityContextUtils.getUserId())) {
			return;
		}
		throw new AccessDeniedException("无权限删除该文件");
	}

	private void assertReadableFile(File file) {
		if (Objects.equals(file.getCreateBy(), SecurityContextUtils.getUserId())
				|| Objects.equals(file.getShared(), 1)) {
			return;
		}
		throw new AccessDeniedException("无权限访问该文件");
	}

	private ResponseEntity<Resource> buildFileResponse(FileQuery query, File file) {
		Optional<MediaType> mediaType = MediaTypeFactory.getMediaType(file.getOriginalName());
		HttpHeaders headers = new HttpHeaders();
		if (query.getHeaders() != null) {
			headers.putAll(query.getHeaders());
		}
		headers.add("X-Content-Type-Options", "nosniff");
		boolean safeInline = query.getDispositionType() == AppConsts.DispositionTypeEnum.inline && isSafeInline(file);
		MediaType responseMediaType = safeInline ? mediaType.orElse(MediaType.APPLICATION_OCTET_STREAM)
				: MediaType.APPLICATION_OCTET_STREAM;
		String contentDisposition = safeInline ? AppConsts.DispositionTypeEnum.inline.name()
				: HTTPUtils.getContentDispositionValue(file.getOriginalName());
		String filePath = query.getId().contains("@") ? file.getThumbFilePath() : file.getFilePath();
		if (StringUtils.isBlank(filePath)) {
			throw new ErrorCodeException(ErrorCode.FileNotExists);
		}
		// FIXME: 在线预览 mp4 文件会报错，但不影响使用
		return ResponseEntity.ok().contentType(responseMediaType).headers(headers)
				.header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
				.body(new InputStreamResource(storageService.downloadAsStream(filePath)));
	}

	private boolean isSafeInline(File file) {
		String extName = StringUtils.substringAfterLast(file.getOriginalName(), ".");
		return StringUtils.isNotBlank(extName) && SAFE_INLINE_EXTENSIONS.contains(extName.toLowerCase(Locale.ROOT));
	}

	@Override
	public ResponseEntity<Resource> downloadTemplate(String name) {
		String templateName = name + ".xlsx";
		return ResponseEntity.ok()
				.header(HttpHeaders.CONTENT_DISPOSITION, HTTPUtils.getContentDispositionValue(templateName))
				.contentType(MediaType.parseMediaType("application/vnd.ms-excel"))
				.body(new ClassPathResource("template/" + templateName));
	}

	private static final class UploadRateWindow {

		private long windowStart;

		private int count;

		private UploadRateWindow(long windowStart) {
			this.windowStart = windowStart;
		}

		private synchronized boolean tryAcquire(int limit, long now) {
			if (isExpired(now)) {
				windowStart = now;
				count = 0;
			}
			if (count >= limit) {
				return false;
			}
			count++;
			return true;
		}

		private synchronized boolean isExpired(long now) {
			return now - windowStart >= 60000;
		}

	}

}
