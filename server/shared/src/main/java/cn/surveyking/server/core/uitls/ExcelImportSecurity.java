package cn.surveyking.server.core.uitls;

import cn.surveyking.server.core.constant.ErrorCode;
import cn.surveyking.server.core.exception.ErrorCodeException;
import org.dhatim.fastexcel.reader.Cell;
import org.dhatim.fastexcel.reader.Row;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Excel 导入资源限制。所有工作簿在交给解析器之前先执行有界 ZIP 检查，解析过程中再限制结构规模。
 */
public final class ExcelImportSecurity {

	private static final long MAX_FILE_SIZE = 20L * 1024 * 1024;

	private static final long MAX_UNCOMPRESSED_SIZE = 100L * 1024 * 1024;

	private static final long MAX_ENTRY_SIZE = 50L * 1024 * 1024;

	private static final int MAX_ZIP_ENTRIES = 1000;

	private static final int MAX_ROWS = 20000;

	private static final int MAX_COLUMNS = 500;

	private static final int MAX_CELL_LENGTH = 32767;

	private ExcelImportSecurity() {
	}

	public static void validateFile(MultipartFile file) {
		if (file == null || file.isEmpty() || file.getSize() > MAX_FILE_SIZE) {
			throw new ErrorCodeException(ErrorCode.FileParseError);
		}

		long totalSize = 0;
		int entryCount = 0;
		boolean contentTypesFound = false;
		byte[] buffer = new byte[8192];
		try (InputStream inputStream = file.getInputStream(); ZipInputStream zip = new ZipInputStream(inputStream)) {
			ZipEntry entry;
			while ((entry = zip.getNextEntry()) != null) {
				if (++entryCount > MAX_ZIP_ENTRIES || isUnsafeEntryName(entry.getName())) {
					throw new ErrorCodeException(ErrorCode.FileParseError);
				}
				contentTypesFound = contentTypesFound || "[Content_Types].xml".equals(entry.getName());
				long entrySize = 0;
				int read;
				while ((read = zip.read(buffer)) != -1) {
					entrySize += read;
					totalSize += read;
					if (entrySize > MAX_ENTRY_SIZE || totalSize > MAX_UNCOMPRESSED_SIZE) {
						throw new ErrorCodeException(ErrorCode.FileParseError);
					}
				}
				long compressedSize = entry.getCompressedSize();
				if (compressedSize > 0 && entrySize > compressedSize * 100) {
					throw new ErrorCodeException(ErrorCode.FileParseError);
				}
			}
		}
		catch (ErrorCodeException e) {
			throw e;
		}
		catch (IOException e) {
			throw new ErrorCodeException(ErrorCode.FileParseError);
		}

		if (entryCount == 0 || !contentTypesFound) {
			throw new ErrorCodeException(ErrorCode.FileParseError);
		}
	}

	private static boolean isUnsafeEntryName(String name) {
		if (name == null || name.indexOf('\0') >= 0 || name.startsWith("/") || name.startsWith("\\")) {
			return true;
		}
		String normalized = name.replace('\\', '/');
		for (String part : normalized.split("/")) {
			if ("..".equals(part)) {
				return true;
			}
		}
		return false;
	}

	public static RowGuard newRowGuard() {
		return new RowGuard();
	}

	public static final class RowGuard {

		private final AtomicInteger rowCount = new AtomicInteger();

		private RowGuard() {
		}

		public void validate(Row row) {
			if (rowCount.incrementAndGet() > MAX_ROWS || row.getCellCount() > MAX_COLUMNS) {
				throw new ErrorCodeException(ErrorCode.FileParseError);
			}
			for (Cell cell : row) {
				if (cell != null && cell.getText() != null && cell.getText().length() > MAX_CELL_LENGTH) {
					throw new ErrorCodeException(ErrorCode.FileParseError);
				}
			}
		}

	}

}
