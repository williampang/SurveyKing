package cn.surveyking.server.impl;

import cn.surveyking.server.core.common.PaginationResponse;
import cn.surveyking.server.core.constant.AppConsts;
import cn.surveyking.server.core.constant.CacheConsts;
import cn.surveyking.server.core.security.PreAuthorizeAnnotationExtractor;
import cn.surveyking.server.core.uitls.RSAUtils;
import cn.surveyking.server.core.uitls.SecurityContextUtils;
import cn.surveyking.server.domain.dto.*;
import cn.surveyking.server.domain.mapper.RoleViewMapper;
import cn.surveyking.server.domain.model.Role;
import cn.surveyking.server.domain.model.SysInfo;
import cn.surveyking.server.domain.model.UserRole;
import cn.surveyking.server.mapper.SysInfoMapper;
import cn.surveyking.server.mapper.UserRoleMapper;
import cn.surveyking.server.service.SystemService;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.CollectionUtils;

import javax.validation.ValidationException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isNotBlank;

/**
 * @author javahuang
 * @date 2021/10/12
 */
@Service
@Transactional(rollbackFor = Exception.class)
@RequiredArgsConstructor
public class SystemServiceImpl implements SystemService {

	private final RoleServiceImpl roleService;

	private final RoleViewMapper roleViewMapper;

	private final CacheManager cacheManager;

	private final UserRoleMapper userRoleMapper;

	private final SysInfoMapper sysInfoMapper;

	@Override
	public SystemInfo getSystemInfo() {
		SystemInfo systemInfo = new SystemInfo();
		systemInfo.setPublicKey(RSAUtils.DEFAULT_PUBLIC_KEY);

		// 数据库只有一条记录，id为1
		SysInfo info = sysInfoMapper.selectById("1");
		if (info != null) {
			BeanUtils.copyProperties(info, systemInfo);
			if (info.getAiSetting() != null) {
				systemInfo.setAiEnabled(info.getAiSetting().getEnabled());
			}
			systemInfo.setOauthProviders(toAvailability(info.getOauthSetting()));
		}
		if (systemInfo.getOauthProviders() == null) {
			systemInfo.setOauthProviders(new OAuthProviderAvailability());
		}
		return systemInfo;
	}

	@Override
	public void updateSystemInfo(SystemInfoRequest request) {
		SysInfo sysInfo = sysInfoMapper.selectById("1");
		boolean exists = sysInfo != null;
		if (!exists) {
			sysInfo = new SysInfo();
			sysInfo.setId("1");
		}
		mergeSysInfo(sysInfo, request);
		if (exists) {
			sysInfoMapper.updateById(sysInfo);
		}
		else {
			sysInfoMapper.insert(sysInfo);
		}
	}

	@Override
	public PaginationResponse<RoleView> getRoles(RoleQuery query) {
		Page<Role> rolePage = roleService.pageByQuery(query,
				Wrappers.<Role>lambdaQuery().like(isNotBlank(query.getName()), Role::getName, query.getName()));
		return new PaginationResponse<>(rolePage.getTotal(),
				rolePage.getRecords().stream().map(x -> roleViewMapper.toView(x)).collect(Collectors.toList()));
	}

	@Override
	public void createRole(RoleRequest request) {
		assertRoleMutationAllowed(null, request);
		if (request.getStatus() == null) {
			request.setStatus(AppConsts.USER_STATUS.VALID);
		}
		roleService.save(roleViewMapper.fromRequest(request));
	}

	@Override
	public void updateRole(RoleRequest request) {
		Role role = roleService.getById(request.getId());
		if (role == null) {
			throw new AccessDeniedException("角色不存在");
		}
		assertRoleMutationAllowed(role, request);
		if (!CollectionUtils.isEmpty(request.getUserIds())) {
			// 批量添加角色用户
			for (String userId : request.getUserIds()) {
				UserRole userRole = new UserRole();
				userRole.setUserId(userId);
				userRole.setRoleId(request.getId());
				userRoleMapper.insert(userRole);
			}
			evictUsers(request.getUserIds());
		}
		else if (!CollectionUtils.isEmpty(request.getEvictUserIds())) {
			// 批量移除用户角色
			userRoleMapper.delete(Wrappers.<UserRole>lambdaUpdate().eq(UserRole::getRoleId, request.getId())
					.in(UserRole::getUserId, request.getEvictUserIds()));
			evictUsers(request.getEvictUserIds());
		}
		else {
			roleService.updateById(roleViewMapper.fromRequest(request));
			evictCache(request.getId());
		}
	}

	@Override
	public void deleteRole(RoleRequest request) {
		Role role = roleService.getById(request.getId());
		if (role == null) {
			return;
		}
		if ("admin".equals(role.getCode())) {
			throw new AccessDeniedException("不能删除系统管理员角色");
		}
		assertRoleMutationAllowed(role, request);
		List<String> affectedUserIds = getRoleUserIds(request.getId());
		roleService.removeById(request.getId());
		userRoleMapper.delete(Wrappers.<UserRole>lambdaQuery().eq(UserRole::getRoleId, request.getId()));
		evictUsers(affectedUserIds);
	}

	/**
	 * 角色信息变化时，清除对应的 cache 缓存
	 * @param roleId
	 */
	private void evictCache(String roleId) {
		evictUsers(getRoleUserIds(roleId));
	}

	private List<String> getRoleUserIds(String roleId) {
		return userRoleMapper.selectList(Wrappers.<UserRole>lambdaQuery().eq(UserRole::getRoleId, roleId)).stream()
				.map(UserRole::getUserId).filter(Objects::nonNull).distinct().collect(Collectors.toList());
	}

	private void evictUsers(Collection<String> userIds) {
		Cache userCache = cacheManager.getCache(CacheConsts.userCacheName);
		if (userCache == null || userIds == null) {
			return;
		}
		Set<String> affectedUserIds = userIds.stream().filter(Objects::nonNull).collect(Collectors.toSet());
		Runnable evict = () -> affectedUserIds.forEach(userCache::evictIfPresent);
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

	private void assertRoleMutationAllowed(Role existingRole, RoleRequest request) {
		String requestedCode = request.getCode() != null ? request.getCode()
				: existingRole == null ? null : existingRole.getCode();
		if ("admin".equals(requestedCode) && (existingRole == null || !"admin".equals(existingRole.getCode()))) {
			throw new AccessDeniedException("管理员角色编码为系统保留值");
		}
		if (existingRole != null && "admin".equals(existingRole.getCode())) {
			if (!SecurityContextUtils.isAdmin()) {
				throw new AccessDeniedException("只有管理员可以修改管理员角色");
			}
			if ((request.getCode() != null && !"admin".equals(request.getCode())) || (request.getStatus() != null
					&& !Objects.equals(request.getStatus(), AppConsts.USER_STATUS.VALID))) {
				throw new AccessDeniedException("不能更改管理员角色编码或停用管理员角色");
			}
		}

		List<String> authorities = request.getAuthorities() == null ? Collections.emptyList() : request.getAuthorities()
				.stream().filter(org.springframework.util.StringUtils::hasText).distinct().collect(Collectors.toList());
		if (authorities.stream().anyMatch(authority -> authority.startsWith("ROLE_"))) {
			throw new AccessDeniedException("角色权限中不允许直接声明 ROLE_ 权限");
		}
		if (SecurityContextUtils.isAdmin()) {
			return;
		}

		Set<String> callerAuthorities = SecurityContextUtils.getUser().getAuthorities().stream()
				.map(authority -> authority.getAuthority()).collect(Collectors.toSet());
		Set<String> effectiveAuthorities = new HashSet<>(authorities);
		if (existingRole != null && request.getAuthorities() == null && isNotBlank(existingRole.getAuthority())) {
			effectiveAuthorities.addAll(Arrays.asList(existingRole.getAuthority().split(",")));
		}
		if ("admin".equals(requestedCode) || effectiveAuthorities.contains(AppConsts.ROLE_ADMIN)
				|| !callerAuthorities.containsAll(effectiveAuthorities)) {
			throw new AccessDeniedException("不能授予高于当前用户的权限");
		}
	}

	@Override
	public List<PermissionView> getPermissions() {
		return PreAuthorizeAnnotationExtractor.extractAllApiPermissions().stream().map(x -> new PermissionView(x))
				.collect(Collectors.toList());
	}

	@Override
	public void extractCodeDiffDbPermissions() {
		// TODO:
	}

	@Override
	public SystemInfo.AiSetting getSystemAiSetting() {
		// 数据库只有一条记录，id为1
		SysInfo info = sysInfoMapper.selectById("1");
		return info != null && info.getAiSetting() != null ? info.getAiSetting() : new SystemInfo.AiSetting();
	}

	@Override
	public OAuthSetting getSystemOAuthSetting() {
		SysInfo info = sysInfoMapper.selectById("1");
		return info != null && info.getOauthSetting() != null ? info.getOauthSetting() : new OAuthSetting();
	}

	@Override
	public OAuthSettingView getOAuthSettingView() {
		OAuthSetting setting = getSystemOAuthSetting();
		OAuthSettingView view = new OAuthSettingView();
		view.setPublicBaseUrl(setting.getPublicBaseUrl());
		view.setGoogle(toGoogleView(setting.getGoogle()));
		view.setWechatWeb(toWechatView(setting.getWechatWeb()));
		view.setWechatOfficial(toWechatView(setting.getWechatOfficial()));
		return view;
	}

	@Override
	public void updateOAuthSetting(OAuthSettingRequest request) {
		SysInfo sysInfo = sysInfoMapper.selectById("1");
		boolean exists = sysInfo != null;
		if (!exists) {
			sysInfo = new SysInfo();
			sysInfo.setId("1");
		}
		OAuthSetting setting = sysInfo.getOauthSetting();
		if (setting == null) {
			setting = new OAuthSetting();
		}
		setting.setPublicBaseUrl(normalizeBaseUrl(request.getPublicBaseUrl()));
		setting.setGoogle(mergeGoogle(setting.getGoogle(), request.getGoogle()));
		setting.setWechatWeb(mergeWechat(setting.getWechatWeb(), request.getWechatWeb()));
		setting.setWechatOfficial(mergeWechat(setting.getWechatOfficial(), request.getWechatOfficial()));
		validateOAuthSetting(setting);
		sysInfo.setOauthSetting(setting);
		if (exists) {
			sysInfoMapper.updateById(sysInfo);
		}
		else {
			sysInfoMapper.insert(sysInfo);
		}
	}

	private OAuthProviderAvailability toAvailability(OAuthSetting setting) {
		if (setting == null || !isNotBlank(setting.getPublicBaseUrl())) {
			return new OAuthProviderAvailability();
		}
		return new OAuthProviderAvailability(isGoogleComplete(setting.getGoogle()),
				isWechatComplete(setting.getWechatWeb()), isWechatComplete(setting.getWechatOfficial()));
	}

	private OAuthSettingView.GoogleClient toGoogleView(OAuthSetting.GoogleClient client) {
		OAuthSettingView.GoogleClient view = new OAuthSettingView.GoogleClient();
		if (client != null) {
			view.setEnabled(client.getEnabled());
			view.setClientId(client.getClientId());
			view.setSecretConfigured(isNotBlank(client.getClientSecret()));
		}
		return view;
	}

	private OAuthSettingView.WechatClient toWechatView(OAuthSetting.WechatClient client) {
		OAuthSettingView.WechatClient view = new OAuthSettingView.WechatClient();
		if (client != null) {
			view.setEnabled(client.getEnabled());
			view.setAppId(client.getAppId());
			view.setSecretConfigured(isNotBlank(client.getAppSecret()));
		}
		return view;
	}

	private OAuthSetting.GoogleClient mergeGoogle(OAuthSetting.GoogleClient target,
			OAuthSettingRequest.GoogleClient source) {
		OAuthSetting.GoogleClient result = target == null ? new OAuthSetting.GoogleClient() : target;
		if (source == null) {
			return result;
		}
		result.setEnabled(source.getEnabled());
		result.setClientId(trimToNull(source.getClientId()));
		if (isNotBlank(source.getClientSecret())) {
			result.setClientSecret(source.getClientSecret().trim());
		}
		else if (Boolean.TRUE.equals(source.getClearSecret())) {
			result.setClientSecret(null);
		}
		return result;
	}

	private OAuthSetting.WechatClient mergeWechat(OAuthSetting.WechatClient target,
			OAuthSettingRequest.WechatClient source) {
		OAuthSetting.WechatClient result = target == null ? new OAuthSetting.WechatClient() : target;
		if (source == null) {
			return result;
		}
		result.setEnabled(source.getEnabled());
		result.setAppId(trimToNull(source.getAppId()));
		if (isNotBlank(source.getAppSecret())) {
			result.setAppSecret(source.getAppSecret().trim());
		}
		else if (Boolean.TRUE.equals(source.getClearSecret())) {
			result.setAppSecret(null);
		}
		return result;
	}

	private void validateOAuthSetting(OAuthSetting setting) {
		boolean anyEnabled = Boolean.TRUE.equals(setting.getGoogle() == null ? null : setting.getGoogle().getEnabled())
				|| Boolean.TRUE.equals(setting.getWechatWeb() == null ? null : setting.getWechatWeb().getEnabled())
				|| Boolean.TRUE
						.equals(setting.getWechatOfficial() == null ? null : setting.getWechatOfficial().getEnabled());
		if (anyEnabled && !isNotBlank(setting.getPublicBaseUrl())) {
			throw new ValidationException("启用第三方登录前必须配置系统外部访问地址");
		}
		if (Boolean.TRUE.equals(setting.getGoogle() == null ? null : setting.getGoogle().getEnabled())
				&& !isGoogleComplete(setting.getGoogle())) {
			throw new ValidationException("Google Client ID 和 Client Secret 不能为空");
		}
		if (Boolean.TRUE.equals(setting.getWechatWeb() == null ? null : setting.getWechatWeb().getEnabled())
				&& !isWechatComplete(setting.getWechatWeb())) {
			throw new ValidationException("微信网站应用 AppID 和 AppSecret 不能为空");
		}
		if (Boolean.TRUE.equals(setting.getWechatOfficial() == null ? null : setting.getWechatOfficial().getEnabled())
				&& !isWechatComplete(setting.getWechatOfficial())) {
			throw new ValidationException("微信公众号 AppID 和 AppSecret 不能为空");
		}
	}

	private String normalizeBaseUrl(String value) {
		String normalized = trimToNull(value);
		if (normalized == null) {
			return null;
		}
		while (normalized.endsWith("/")) {
			normalized = normalized.substring(0, normalized.length() - 1);
		}
		try {
			URI uri = new URI(normalized);
			boolean validScheme = "https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme());
			if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null
					|| uri.getFragment() != null || (uri.getPath() != null && !uri.getPath().isEmpty())
					|| !validScheme) {
				throw new ValidationException("系统外部访问地址必须以 http:// 或 https:// 开头，且不能包含路径、查询参数或片段");
			}
		}
		catch (URISyntaxException ex) {
			throw new ValidationException("系统外部访问地址格式不正确");
		}
		return normalized;
	}

	private boolean isGoogleComplete(OAuthSetting.GoogleClient client) {
		return client != null && Boolean.TRUE.equals(client.getEnabled()) && isNotBlank(client.getClientId())
				&& isNotBlank(client.getClientSecret());
	}

	private boolean isWechatComplete(OAuthSetting.WechatClient client) {
		return client != null && Boolean.TRUE.equals(client.getEnabled()) && isNotBlank(client.getAppId())
				&& isNotBlank(client.getAppSecret());
	}

	private String trimToNull(String value) {
		return isNotBlank(value) ? value.trim() : null;
	}

	private void mergeSysInfo(SysInfo target, SystemInfoRequest request) {
		if (isNotBlank(request.getName())) {
			target.setName(request.getName());
		}
		if (isNotBlank(request.getDescription())) {
			target.setDescription(request.getDescription());
		}
		if (isNotBlank(request.getAvatar())) {
			target.setAvatar(request.getAvatar());
		}
		if (isNotBlank(request.getLocale())) {
			target.setLocale(request.getLocale());
		}
		if (request.getRegisterInfo() != null) {
			SystemInfo.RegisterInfo source = request.getRegisterInfo();
			SystemInfo.RegisterInfo registerInfo = target.getRegisterInfo();
			if (registerInfo == null) {
				registerInfo = new SystemInfo.RegisterInfo();
				target.setRegisterInfo(registerInfo);
			}
			if (source.getRegisterEnabled() != null) {
				registerInfo.setRegisterEnabled(source.getRegisterEnabled());
			}
			if (source.getRoles() != null) {
				registerInfo.setRoles(source.getRoles());
			}
			if (source.getStrongPasswordEnabled() != null) {
				registerInfo.setStrongPasswordEnabled(source.getStrongPasswordEnabled());
			}
		}
		if (request.getSetting() != null) {
			SystemInfo.SystemSetting source = request.getSetting();
			SystemInfo.SystemSetting setting = target.getSetting();
			if (setting == null) {
				setting = new SystemInfo.SystemSetting();
				target.setSetting(setting);
			}
			if (source.getCaptchaEnabled() != null) {
				setting.setCaptchaEnabled(source.getCaptchaEnabled());
			}
			if (isNotBlank(source.getCopyright())) {
				setting.setCopyright(source.getCopyright());
			}
			if (isNotBlank(source.getRecordNum())) {
				setting.setRecordNum(source.getRecordNum());
			}
			if (isNotBlank(source.getAmapKey())) {
				setting.setAmapKey(source.getAmapKey());
			}
			if (isNotBlank(source.getAmapSecurityJsCode())) {
				setting.setAmapSecurityJsCode(source.getAmapSecurityJsCode());
			}
		}
		if (request.getAiSetting() != null) {
			SystemInfo.AiSetting source = request.getAiSetting();
			SystemInfo.AiSetting aiSetting = target.getAiSetting();
			if (aiSetting == null) {
				aiSetting = new SystemInfo.AiSetting();
				target.setAiSetting(aiSetting);
			}
			if (source.getEnabled() != null) {
				aiSetting.setEnabled(source.getEnabled());
			}
			if (source.getModels() != null) {
				aiSetting.setModels(source.getModels());
			}
			if (source.getBaseUrl() != null) {
				aiSetting.setBaseUrl(source.getBaseUrl().trim());
			}
			if (source.getDefaultModel() != null) {
				aiSetting.setDefaultModel(source.getDefaultModel());
			}
			if (isNotBlank(source.getApiKey())) {
				aiSetting.setApiKey(source.getApiKey());
			}
			if (isNotBlank(source.getToken())) {
				aiSetting.setToken(source.getToken());
			}
			if (source.getPrompt() != null) {
				aiSetting.setPrompt(source.getPrompt());
			}
		}
	}

}
