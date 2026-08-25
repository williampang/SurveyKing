package cn.surveyking.server.impl;

import cn.surveyking.server.core.common.PaginationResponse;
import cn.surveyking.server.core.constant.AppConsts;
import cn.surveyking.server.core.constant.CacheConsts;
import cn.surveyking.server.core.constant.ProjectPartnerTypeEnum;
import cn.surveyking.server.core.exception.InternalServerError;
import cn.surveyking.server.core.uitls.ContextHelper;
import cn.surveyking.server.core.uitls.ExcelImportSecurity;
import cn.surveyking.server.core.uitls.ExcelExporter;
import cn.surveyking.server.core.uitls.SecurityContextUtils;
import cn.surveyking.server.domain.dto.ProjectPartnerQuery;
import cn.surveyking.server.domain.dto.ProjectPartnerRequest;
import cn.surveyking.server.domain.dto.ProjectPartnerView;
import cn.surveyking.server.domain.dto.WhiteListRequest;
import cn.surveyking.server.domain.mapper.ProjectPartnerViewMapper;
import cn.surveyking.server.domain.model.ProjectPartner;
import cn.surveyking.server.domain.model.User;
import cn.surveyking.server.mapper.ProjectPartnerMapper;
import cn.surveyking.server.service.BaseService;
import cn.surveyking.server.service.ProjectPartnerService;
import cn.surveyking.server.service.UserService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.CollectionUtils;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.dhatim.fastexcel.reader.ReadableWorkbook;
import org.dhatim.fastexcel.reader.Row;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * @author javahuang
 * @date 2022/1/28
 */
@Service
@Transactional(rollbackFor = Exception.class)
@RequiredArgsConstructor
public class ProjectPartnerServiceImpl extends BaseService<ProjectPartnerMapper, ProjectPartner>
		implements ProjectPartnerService {

	private final UserServiceImpl userService;

	private final CacheManager cacheManager;

	private final ProjectPartnerViewMapper projectPartnerViewMapper;

	@Override
	public PaginationResponse<ProjectPartnerView> listProjectPartner(ProjectPartnerQuery query) {
		Page<ProjectPartner> page = pageByQuery(query,
				Wrappers.<ProjectPartner>lambdaQuery().eq(ProjectPartner::getProjectId, query.getProjectId())
						.in(query.getTypes() != null, ProjectPartner::getType, query.getTypes())
						.eq(query.getStatus() != null, ProjectPartner::getStatus, query.getStatus()).like(
								query.getUserName() != null
										&& query.getTypes() != null
										&& query.getTypes()
												.contains(ProjectPartnerTypeEnum.RESPONDENT_IMP_USER.getType()),
								ProjectPartner::getUserName, query.getUserName())
						.apply(query.getUserName() != null,
								"EXISTS (SELECT 1 FROM t_user WHERE t_user.name = {0} AND t_user.id = t_project_partner.user_id)",
								query.getUserName())
						.orderByAsc(ProjectPartner::getCreateAt));
		PaginationResponse<ProjectPartnerView> result = new PaginationResponse<>(page.getTotal(),
				projectPartnerViewMapper.toView(page.getRecords()));
		for (ProjectPartnerView view : result.getList()) {
			if (view.getUserId() != null) {
				view.setUser(userService.loadUserById(view.getUserId()));
			}
		}
		return result;
	}

	@Override
	public void addProjectPartner(ProjectPartnerRequest request) {
		if (ProjectPartnerTypeEnum.OWNER.getType() == request.getType()
				&& count(Wrappers.<ProjectPartner>lambdaQuery().eq(ProjectPartner::getProjectId, request.getProjectId())
						.eq(ProjectPartner::getType, ProjectPartnerTypeEnum.OWNER.getType())) > 0) {
			throw new AccessDeniedException("请使用专用的所有权转移功能");
		}
		// 添加答题人
		List<ProjectPartner> existUserIds = list(Wrappers.<ProjectPartner>lambdaQuery()
				.in(request.getUserIds() != null, ProjectPartner::getUserId, request.getUserIds())
				.in(request.getUserNames() != null
						&& ProjectPartnerTypeEnum.RESPONDENT_IMP_USER.getType() == request.getType(),
						ProjectPartner::getUserName, request.getUserNames())
				.eq(ProjectPartner::getType, request.getType())
				.eq(ProjectPartner::getProjectId, request.getProjectId()));
		if (ProjectPartnerTypeEnum.RESPONDENT_IMP_USER.getType() == request.getType()) {
			saveBatch(request.getUserNames().stream().filter(username -> {
				if (existUserIds.stream().anyMatch(partner -> partner.getUserName().equals(username))) {
					return false;
				}
				return true;
			}).map(userName -> {
				ProjectPartner partner = new ProjectPartner();
				partner.setProjectId(request.getProjectId());
				partner.setUserName(userName);
				partner.setType(request.getType());
				return partner;
			}).collect(Collectors.toList()));
		}
		else {
			List<ProjectPartner> newPartners = request.getUserIds().stream().filter(userId -> {
				if (existUserIds.stream().anyMatch(partner -> partner.getUserId().equals(userId))) {
					return false;
				}
				return true;
			}).map(userId -> {
				ProjectPartner partner = new ProjectPartner();
				partner.setProjectId(request.getProjectId());
				partner.setUserId(userId);
				partner.setType(request.getType());
				return partner;
			}).collect(Collectors.toList());
			saveBatch(newPartners);
			evictProjectPermissions(newPartners);
		}
	}

	@Override
	public void deleteProjectPartner(ProjectPartnerRequest request) {
		if (CollectionUtils.isEmpty(request.getIds()) && CollectionUtils.isEmpty(request.getProjectIds())
				&& request.getProjectId() == null) {
			throw new AccessDeniedException("未指定要删除的项目成员");
		}
		List<ProjectPartner> partners = list(Wrappers.<ProjectPartner>lambdaQuery()
				.in(CollectionUtils.isNotEmpty(request.getIds()), ProjectPartner::getId, request.getIds())
				.in(CollectionUtils.isNotEmpty(request.getProjectIds()), ProjectPartner::getProjectId,
						request.getProjectIds())
				.eq(request.getProjectId() != null, ProjectPartner::getProjectId, request.getProjectId()));
		if (partners.stream()
				.anyMatch(partner -> Objects.equals(partner.getType(), ProjectPartnerTypeEnum.OWNER.getType()))) {
			throw new AccessDeniedException("不能通过成员删除接口删除项目所有者");
		}
		if (!partners.isEmpty()) {
			removeByIds(partners.stream().map(ProjectPartner::getId).collect(Collectors.toList()));
		}
		evictProjectPermissions(partners);
	}

	@Override
	public void deleteAllProjectPartners(List<String> projectIds) {
		if (CollectionUtils.isEmpty(projectIds)) {
			return;
		}
		List<ProjectPartner> partners = list(
				Wrappers.<ProjectPartner>lambdaQuery().in(ProjectPartner::getProjectId, projectIds));
		if (!partners.isEmpty()) {
			removeByIds(partners.stream().map(ProjectPartner::getId).collect(Collectors.toList()));
		}
		evictProjectPermissions(partners);
	}

	@Override
	public void assertProjectOwner(String projectId) {
		if (projectId == null
				|| count(Wrappers.<ProjectPartner>lambdaQuery().eq(ProjectPartner::getProjectId, projectId)
						.eq(ProjectPartner::getUserId, SecurityContextUtils.getUserId())
						.eq(ProjectPartner::getType, ProjectPartnerTypeEnum.OWNER.getType())) == 0) {
			throw new AccessDeniedException("只有项目所有者可以管理成员");
		}
	}

	private void evictProjectPermissions(Collection<ProjectPartner> partners) {
		Cache permissionCache = cacheManager.getCache(CacheConsts.projectPermissionCacheName);
		if (permissionCache == null || partners == null) {
			return;
		}
		Set<String> affectedUserIds = partners.stream()
				.filter(partner -> Objects.equals(partner.getType(), ProjectPartnerTypeEnum.OWNER.getType())
						|| Objects.equals(partner.getType(), ProjectPartnerTypeEnum.COLLABORATOR.getType()))
				.map(ProjectPartner::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());
		Runnable evict = () -> affectedUserIds.forEach(permissionCache::evictIfPresent);
		if (TransactionSynchronizationManager.isActualTransactionActive()
				&& TransactionSynchronizationManager.isSynchronizationActive()) {
			TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
				@Override
				public void afterCommit() {
					evict.run();
				}
			});
		}
		else {
			evict.run();
		}
	}

	@Override
	public List<String> getProjectPerms() {
		return getBaseMapper().getProjectPerms(SecurityContextUtils.getUserId());
	}

	@Override
	@SneakyThrows
	public void downloadPartner(ProjectPartnerQuery query) {
		query.setPageSize(-1);
		List<ProjectPartnerView> result = listProjectPartner(query).getList();
		List<List<Object>> rows = result.stream().map(r -> {
			List<Object> row = new ArrayList<>();
			if (r.getType() == ProjectPartnerTypeEnum.RESPONDENT_SYS_USER.getType()) {
				row.add(r.getUser().getName());
			}
			else {
				row.add(r.getUserName());
			}
			row.add(AppConsts.ProjectPartnerStatus.getStatusStr(r.getStatus()));
			return row;
		}).collect(Collectors.toList());
		new ExcelExporter.Builder().setOutputStream(ContextHelper.getCurrentHttpResponse().getOutputStream())
				.setRows(rows).setColumns(Arrays.asList("名单", "状态")).build().exportToStream();
	}

	@Override
	@SneakyThrows
	public void importPartner(WhiteListRequest request) {
		ExcelImportSecurity.validateFile(request.getFile());
		ExcelImportSecurity.RowGuard rowGuard = ExcelImportSecurity.newRowGuard();
		List<String> userIds = new ArrayList<>();
		try (InputStream is = request.getFile().getInputStream(); ReadableWorkbook wb = new ReadableWorkbook(is)) {
			wb.getSheets().forEach(sheet -> {
				int[] rowNum = { 1 };
				try (Stream<Row> rows = sheet.openStream()) {
					rows.forEach(r -> {
						rowGuard.validate(r);
						if (r.getRowNum() == 1) {
							return;
						}
						rowNum[0] = r.getRowNum();
						if (getCellValue(r, 0).isPresent() && getCellValue(r, 1).isPresent()) {
							User user = userService.getBaseMapper().getUser(getCellValue(r, 0).get(),
									getCellValue(r, 1).get());
							if (user != null) {
								userIds.add(user.getId());
							}
						}

					});
				}
				catch (Exception e) {
					throw new InternalServerError(String.format("模板第%d行解析失败", rowNum[0]), e);
				}
			});
		}
		ProjectPartnerRequest addRequest = new ProjectPartnerRequest();
		addRequest.setProjectId(request.getProjectId());
		addRequest.setUserIds(userIds);
		addRequest.setType(ProjectPartnerTypeEnum.RESPONDENT_SYS_USER.getType());
		addProjectPartner(addRequest);
	}

	private Optional<String> getCellValue(Row row, int cellIndex) {
		String cellValue = row.getCellAsString(cellIndex).orElse(null);
		if (isBlank(cellValue)) {
			return Optional.empty();
		}
		return Optional.of(cellValue);
	}

}
