package cn.surveyking.server.impl;

import cn.surveyking.server.core.constant.AppConsts;
import cn.surveyking.server.core.constant.CacheConsts;
import cn.surveyking.server.domain.dto.OAuthBindingView;
import cn.surveyking.server.domain.dto.OAuthCallbackResult;
import cn.surveyking.server.domain.dto.OAuthRegistrationView;
import cn.surveyking.server.domain.dto.OAuthSetting;
import cn.surveyking.server.domain.dto.OAuthStartResponse;
import cn.surveyking.server.domain.dto.ProjectSetting;
import cn.surveyking.server.domain.dto.ProjectView;
import cn.surveyking.server.domain.dto.RegisterRequest;
import cn.surveyking.server.domain.dto.SurveyWechatIdentity;
import cn.surveyking.server.domain.dto.SystemInfo;
import cn.surveyking.server.domain.model.Account;
import cn.surveyking.server.domain.model.User;
import cn.surveyking.server.mapper.AccountMapper;
import cn.surveyking.server.mapper.UserMapper;
import cn.surveyking.server.service.OAuthService;
import cn.surveyking.server.service.ProjectService;
import cn.surveyking.server.service.SystemService;
import cn.surveyking.server.service.UserService;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import javax.validation.ValidationException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@Transactional(rollbackFor = Exception.class)
public class OAuthServiceImpl implements OAuthService {

	private static final Logger LOGGER = LoggerFactory.getLogger(OAuthServiceImpl.class);

	private static final TypeReference<Map<String, Object>> JSON_MAP_TYPE = new TypeReference<Map<String, Object>>() {
	};

	private static final String GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";

	private static final String GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

	private static final String GOOGLE_JWK_SET_URL = "https://www.googleapis.com/oauth2/v3/certs";

	private static final String GOOGLE_ISSUER = "https://accounts.google.com";

	private static final String WECHAT_WEB_AUTHORIZATION_URL = "https://open.weixin.qq.com/connect/qrconnect";

	private static final String WECHAT_OFFICIAL_AUTHORIZATION_URL = "https://open.weixin.qq.com/connect/oauth2/authorize";

	private static final String WECHAT_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token";

	private static final String WECHAT_USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo";

	private static final String MODE_REDIRECT = "redirect";

	private static final String MODE_WECHAT_QR = "wechat_qr";

	private static final String REGISTRATION_TICKET_PREFIX = "register:";

	private final SystemService systemService;

	private final AccountMapper accountMapper;

	private final UserMapper userMapper;

	private final ProjectService projectService;

	private final UserService userService;

	private final CacheManager cacheManager;

	private final RestTemplate restTemplate;

	private final ObjectMapper objectMapper;

	private final NimbusJwtDecoder googleJwtDecoder;

	private final SecureRandom secureRandom = new SecureRandom();

	public OAuthServiceImpl(SystemService systemService, AccountMapper accountMapper, UserMapper userMapper,
			ProjectService projectService, UserService userService, CacheManager cacheManager,
			RestTemplateBuilder restTemplateBuilder, ObjectMapper objectMapper) {
		this.systemService = systemService;
		this.accountMapper = accountMapper;
		this.userMapper = userMapper;
		this.projectService = projectService;
		this.userService = userService;
		this.cacheManager = cacheManager;
		this.objectMapper = objectMapper;
		this.restTemplate = restTemplateBuilder.setConnectTimeout(Duration.ofSeconds(5))
				.setReadTimeout(Duration.ofSeconds(10)).build();
		this.googleJwtDecoder = NimbusJwtDecoder.withJwkSetUri(GOOGLE_JWK_SET_URL).build();
		this.googleJwtDecoder.setJwtValidator(JwtValidators.createDefault());
	}

	@Override
	public OAuthStartResponse startLogin(String provider, String redirect, String userAgent) {
		return start(provider, true, null, redirect, userAgent);
	}

	@Override
	public OAuthStartResponse startBind(String provider, String redirect, String userAgent, String userId) {
		if (!StringUtils.isNotBlank(userId)) {
			throw new ValidationException("请先登录后再绑定第三方账号");
		}
		return start(provider, false, userId, redirect, userAgent);
	}

	@Override
	public OAuthStartResponse startSurveyWechat(String projectId, String redirect, String userAgent) {
		if (!isWechat(userAgent)) {
			throw new ValidationException("请在微信中打开问卷");
		}
		ProjectView project = projectService.getProject(projectId);
		ProjectSetting.AnswerSetting answerSetting = project == null || project.getSetting() == null ? null
				: project.getSetting().getAnswerSetting();
		if (answerSetting == null || !Boolean.TRUE.equals(answerSetting.getWechatOnly())) {
			throw new ValidationException("当前问卷未开启微信填写限制");
		}

		OAuthSetting setting = systemService.getSystemOAuthSetting();
		ensureChannelEnabled(setting, "wechat-official");
		OAuthFlowTransaction transaction = new OAuthFlowTransaction();
		transaction.state = randomToken();
		transaction.flowCookie = randomToken();
		transaction.surveyWechat = true;
		transaction.projectId = projectId;
		transaction.collectWechatUserInfo = Boolean.TRUE.equals(answerSetting.getWechatUserInfo());
		transaction.channel = "wechat-official";
		transaction.redirect = safeRedirect(redirect, "/s/" + projectId);
		flowCache().put(transaction.state, transaction);

		OAuthStartResponse response = new OAuthStartResponse();
		response.setFlowCookie(transaction.flowCookie);
		response.setMode(MODE_REDIRECT);
		response.setAuthorizationUrl(buildWechatOfficialAuthorizationUrl(setting.getWechatOfficial(),
				callbackUrl(setting, transaction.channel), transaction.state,
				transaction.collectWechatUserInfo ? "snsapi_userinfo" : "snsapi_base"));
		return response;
	}

	private OAuthStartResponse start(String provider, boolean login, String userId, String redirect, String userAgent) {
		String normalizedProvider = StringUtils.defaultString(provider).toLowerCase(Locale.ROOT);
		String channel;
		if ("google".equals(normalizedProvider)) {
			channel = "google";
		}
		else if ("wechat".equals(normalizedProvider)) {
			channel = isWechat(userAgent) ? "wechat-official" : "wechat-web";
		}
		else {
			throw new ValidationException("不支持的第三方登录方式");
		}

		OAuthSetting setting = systemService.getSystemOAuthSetting();
		ensureChannelEnabled(setting, channel);
		OAuthFlowTransaction transaction = new OAuthFlowTransaction();
		transaction.state = randomToken();
		transaction.flowCookie = randomToken();
		transaction.login = login;
		transaction.userId = userId;
		transaction.channel = channel;
		transaction.redirect = safeRedirect(redirect, login ? "/" : "/account/settings?tab=security");
		transaction.nonce = "google".equals(channel) ? randomToken() : null;
		transaction.codeVerifier = "google".equals(channel) ? randomToken() + randomToken() : null;
		flowCache().put(transaction.state, transaction);

		String callback = callbackUrl(setting, channel);
		OAuthStartResponse response = new OAuthStartResponse();
		response.setFlowCookie(transaction.flowCookie);
		if ("google".equals(channel)) {
			response.setMode(MODE_REDIRECT);
			response.setAuthorizationUrl(buildGoogleAuthorizationUrl(setting.getGoogle(), callback, transaction));
		}
		else if ("wechat-official".equals(channel)) {
			response.setMode(MODE_REDIRECT);
			response.setAuthorizationUrl(buildWechatOfficialAuthorizationUrl(setting.getWechatOfficial(), callback,
					transaction.state, "snsapi_userinfo"));
		}
		else {
			response.setMode(MODE_WECHAT_QR);
			OAuthStartResponse.WechatQr qr = new OAuthStartResponse.WechatQr();
			qr.setAppId(setting.getWechatWeb().getAppId());
			qr.setScope("snsapi_login");
			qr.setRedirectUri(urlEncode(callback));
			qr.setState(transaction.state);
			response.setQr(qr);
		}
		return response;
	}

	@Override
	public OAuthCallbackResult handleCallback(String channel, String code, String state, String providerError,
			String flowCookie, String currentUserId) {
		OAuthFlowTransaction transaction = StringUtils.isNotBlank(state)
				? flowCache().get(state, OAuthFlowTransaction.class) : null;
		if (transaction == null) {
			return OAuthCallbackResult.failure(true, "invalid_state", loginErrorRedirect("invalid_state", "/"));
		}
		flowCache().evict(state);
		if (!channel.equals(transaction.channel) || !constantTimeEquals(transaction.state, state)
				|| !constantTimeEquals(transaction.flowCookie, flowCookie)) {
			return failure(transaction, "invalid_state");
		}
		if (!transaction.login && !transaction.surveyWechat && !StringUtils.equals(transaction.userId, currentUserId)) {
			return failure(transaction, "session_expired");
		}
		if (StringUtils.isNotBlank(providerError) || !StringUtils.isNotBlank(code)
				|| "authdeny".equalsIgnoreCase(code)) {
			return failure(transaction, "access_denied");
		}

		try {
			OAuthSetting setting = systemService.getSystemOAuthSetting();
			ensureChannelEnabled(setting, channel);
			OAuthIdentity identity = "google".equals(channel) ? exchangeGoogle(setting, code, transaction)
					: exchangeWechat(setting, channel, code, transaction.collectWechatUserInfo);
			if (transaction.surveyWechat) {
				SurveyWechatIdentity surveyIdentity = new SurveyWechatIdentity(transaction.projectId, identity.openId,
						identity.nickname, identity.avatarUrl, transaction.collectWechatUserInfo);
				return OAuthCallbackResult.surveyWechatSuccess(surveyIdentity, transaction.redirect);
			}
			if (transaction.login) {
				Account account = resolveIdentityAccount(identity);
				if (account == null) {
					if (!isRegistrationEnabled()) {
						return failure(transaction, "not_bound");
					}
					String ticket = createRegistrationTicket(identity, transaction.redirect);
					return OAuthCallbackResult.pendingRegistration(registrationRedirect(ticket));
				}
				User user = userMapper.selectById(account.getUserId());
				if (user == null || user.getStatus() == null || user.getStatus() != AppConsts.USER_STATUS.VALID) {
					return failure(transaction, "user_disabled");
				}
				if (identity.fallbackAccount != null) {
					bindIdentity(user.getId(), identity);
				}
				return OAuthCallbackResult.success(true, user.getId(), transaction.redirect);
			}

			User user = userMapper.selectById(transaction.userId);
			if (user == null || user.getStatus() == null || user.getStatus() != AppConsts.USER_STATUS.VALID) {
				return failure(transaction, "user_disabled");
			}
			bindIdentity(transaction.userId, identity);
			return OAuthCallbackResult.success(false, transaction.userId,
					"/account/settings?tab=security&oauthBind=success");
		}
		catch (OAuthFlowException ex) {
			TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
			return failure(transaction, ex.error);
		}
		catch (Exception ex) {
			TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
			LOGGER.warn("OAuth callback failed unexpectedly, channel={}, exception={}", channel,
					ex.getClass().getSimpleName());
			return failure(transaction, "provider_error");
		}
	}

	@Override
	@Transactional(readOnly = true)
	public OAuthRegistrationView getRegistration(String ticket) {
		OAuthRegistrationTransaction transaction = getRegistrationTransaction(ticket);
		ensureRegistrationEnabled();
		OAuthRegistrationView view = new OAuthRegistrationView();
		view.setName(oauthDisplayName(transaction.identity));
		view.setUsername(oauthUsername(transaction.identity));
		return view;
	}

	@Override
	public OAuthCallbackResult completeRegistration(String ticket, RegisterRequest request) {
		OAuthRegistrationTransaction transaction = getRegistrationTransaction(ticket);
		ensureRegistrationEnabled();
		if (resolveIdentityAccount(transaction.identity) != null) {
			throw new ValidationException("第三方账号已绑定，请重新登录");
		}

		userService.register(request);
		Account passwordAccount = accountMapper.selectOne(Wrappers.<Account>lambdaQuery()
				.eq(Account::getAuthType, AppConsts.AUTH_TYPE.PWD.name())
				.eq(Account::getAuthAccount, request.getUsername()));
		if (passwordAccount == null || !StringUtils.isNotBlank(passwordAccount.getUserId())) {
			throw new ValidationException("注册失败，请重试");
		}
		bindIdentity(passwordAccount.getUserId(), transaction.identity);
		applyOAuthProfile(passwordAccount.getUserId(), transaction.identity);
		flowCache().evict(registrationCacheKey(ticket));
		return OAuthCallbackResult.success(true, passwordAccount.getUserId(), transaction.redirect);
	}

	@Override
	@Transactional(readOnly = true)
	public List<OAuthBindingView> getBindings(String userId) {
		if (!StringUtils.isNotBlank(userId)) {
			return Collections.emptyList();
		}
		List<Account> accounts = accountMapper
				.selectList(Wrappers.<Account>lambdaQuery().eq(Account::getUserId, userId).in(Account::getAuthType,
						Arrays.asList(AppConsts.AUTH_TYPE.GOOGLE.name(), AppConsts.AUTH_TYPE.WECHAT.name())));
		OAuthSetting setting = systemService.getSystemOAuthSetting();
		List<OAuthBindingView> bindings = new ArrayList<>();
		for (Account account : accounts) {
			OAuthBindingView view = new OAuthBindingView();
			view.setId(account.getId());
			if (AppConsts.AUTH_TYPE.GOOGLE.name().equals(account.getAuthType())) {
				view.setProvider("google");
				view.setChannel("google");
			}
			else {
				view.setProvider("wechat");
				if (account.getAuthAccount().startsWith("unionid:")) {
					view.setChannel("unionid");
					view.setCoversWeb(true);
					view.setCoversOfficial(true);
				}
				else {
					String appId = extractWechatAppId(account.getAuthAccount());
					boolean web = setting.getWechatWeb() != null
							&& StringUtils.equals(appId, setting.getWechatWeb().getAppId());
					boolean official = setting.getWechatOfficial() != null
							&& StringUtils.equals(appId, setting.getWechatOfficial().getAppId());
					view.setChannel(web ? "wechat-web" : official ? "wechat-official" : "wechat-unknown");
					view.setCoversWeb(web);
					view.setCoversOfficial(official);
				}
			}
			bindings.add(view);
		}
		return bindings;
	}

	@Override
	public void unbind(String bindingId, String userId) {
		if (!StringUtils.isNotBlank(bindingId) || !StringUtils.isNotBlank(userId)
				|| accountMapper.physicallyDeleteExternal(bindingId, userId) == 0) {
			throw new ValidationException("绑定记录不存在或不属于当前用户");
		}
	}

	private void bindIdentity(String userId, OAuthIdentity identity) {
		Account existing = selectIdentityAccount(identity.authType, identity.account);
		Account fallback = identity.fallbackAccount == null ? null
				: selectIdentityAccount(identity.authType, identity.fallbackAccount);
		if (fallback != null && !StringUtils.equals(fallback.getUserId(), userId)) {
			throw new OAuthFlowException("identity_conflict");
		}
		if (existing != null) {
			if (!StringUtils.equals(existing.getUserId(), userId)) {
				throw new OAuthFlowException("identity_conflict");
			}
			if (identity.account.startsWith("unionid:")) {
				accountMapper
						.selectList(Wrappers.<Account>lambdaQuery().eq(Account::getUserId, userId)
								.eq(Account::getAuthType, AppConsts.AUTH_TYPE.WECHAT.name()))
						.stream().filter(account -> !StringUtils.equals(existing.getId(), account.getId()))
						.forEach(account -> accountMapper.physicallyDeleteExternal(account.getId(), userId));
			}
			return;
		}

		List<Account> ownAccounts = accountMapper.selectList(Wrappers.<Account>lambdaQuery()
				.eq(Account::getUserId, userId).eq(Account::getAuthType, identity.authType));
		if (AppConsts.AUTH_TYPE.GOOGLE.name().equals(identity.authType)) {
			if (!ownAccounts.isEmpty()) {
				throw new OAuthFlowException("already_bound");
			}
		}
		else if (identity.account.startsWith("unionid:")) {
			for (Account account : ownAccounts) {
				if (account.getAuthAccount().startsWith("unionid:")) {
					throw new OAuthFlowException("already_bound");
				}
			}
			for (Account account : ownAccounts) {
				accountMapper.physicallyDeleteExternal(account.getId(), userId);
			}
		}
		else {
			String targetAppId = extractWechatAppId(identity.account);
			for (Account account : ownAccounts) {
				if (account.getAuthAccount().startsWith("unionid:")
						|| StringUtils.equals(targetAppId, extractWechatAppId(account.getAuthAccount()))) {
					throw new OAuthFlowException("already_bound");
				}
			}
		}

		Account account = new Account();
		account.setUserId(userId);
		account.setUserType(AppConsts.USER_TYPE.SysUser.name());
		account.setAuthType(identity.authType);
		account.setAuthAccount(identity.account);
		account.setStatus(AppConsts.USER_STATUS.VALID);
		try {
			accountMapper.insert(account);
		}
		catch (DuplicateKeyException ex) {
			throw new OAuthFlowException("identity_conflict");
		}
	}

	private boolean isRegistrationEnabled() {
		SystemInfo.RegisterInfo registerInfo = systemService.getSystemInfo().getRegisterInfo();
		return registerInfo != null && Boolean.TRUE.equals(registerInfo.getRegisterEnabled());
	}

	private void applyOAuthProfile(String userId, OAuthIdentity identity) {
		User user = userMapper.selectById(userId);
		if (user == null) {
			throw new ValidationException("注册失败，请重试");
		}
		boolean changed = false;
		if (StringUtils.isBlank(user.getEmail()) && StringUtils.isNotBlank(identity.email)
				&& identity.email.length() <= 50) {
			user.setEmail(identity.email);
			changed = true;
		}
		if (StringUtils.isBlank(user.getAvatar()) && StringUtils.isNotBlank(identity.avatarUrl)
				&& identity.avatarUrl.length() <= 200) {
			user.setAvatar(identity.avatarUrl);
			changed = true;
		}
		if (changed) {
			userMapper.updateById(user);
		}
	}

	private void ensureRegistrationEnabled() {
		if (!isRegistrationEnabled()) {
			throw new ValidationException("系统未开放注册");
		}
	}

	private String createRegistrationTicket(OAuthIdentity identity, String redirect) {
		String ticket = randomToken();
		OAuthRegistrationTransaction transaction = new OAuthRegistrationTransaction();
		transaction.identity = identity;
		transaction.redirect = safeRedirect(redirect, "/");
		flowCache().put(registrationCacheKey(ticket), transaction);
		return ticket;
	}

	private OAuthRegistrationTransaction getRegistrationTransaction(String ticket) {
		OAuthRegistrationTransaction transaction = StringUtils.isNotBlank(ticket)
				? flowCache().get(registrationCacheKey(ticket), OAuthRegistrationTransaction.class) : null;
		if (transaction == null || transaction.identity == null) {
			throw new ValidationException("OAuth 注册信息已失效，请重新登录");
		}
		return transaction;
	}

	private String registrationCacheKey(String ticket) {
		return REGISTRATION_TICKET_PREFIX + StringUtils.defaultString(ticket);
	}

	private String registrationRedirect(String ticket) {
		return UriComponentsBuilder.fromPath("/user/register").queryParam("oauthTicket", ticket).build().encode()
				.toUriString();
	}

	private String oauthUsername(OAuthIdentity identity) {
		String preferred = StringUtils.trim(identity.email);
		if (StringUtils.isNotBlank(preferred) && preferred.length() <= 100 && isUsernameAvailable(preferred)) {
			return preferred;
		}

		String prefix = AppConsts.AUTH_TYPE.GOOGLE.name().equals(identity.authType) ? "google_" : "wechat_";
		String fingerprint = sha256(identity.authType + ":" + identity.account).substring(0, 24);
		String candidate = prefix + fingerprint;
		if (isUsernameAvailable(candidate)) {
			return candidate;
		}
		for (int i = 0; i < 10; i++) {
			candidate = prefix + fingerprint + "_" + randomToken().substring(0, 8);
			if (isUsernameAvailable(candidate)) {
				return candidate;
			}
		}
		throw new OAuthFlowException("provider_error");
	}

	private boolean isUsernameAvailable(String username) {
		return accountMapper.selectCount(Wrappers.<Account>lambdaQuery()
				.eq(Account::getAuthType, AppConsts.AUTH_TYPE.PWD.name()).eq(Account::getAuthAccount, username)) == 0;
	}

	private String oauthDisplayName(OAuthIdentity identity) {
		String name = StringUtils.defaultIfBlank(identity.nickname,
				AppConsts.AUTH_TYPE.GOOGLE.name().equals(identity.authType) ? "Google 用户" : "微信用户");
		StringBuilder sanitized = new StringBuilder();
		name.codePoints().filter(codePoint -> codePoint <= Character.MAX_VALUE && !Character.isISOControl(codePoint))
				.forEach(sanitized::appendCodePoint);
		return StringUtils.left(StringUtils.defaultIfBlank(StringUtils.trim(sanitized.toString()), "第三方用户"), 50);
	}

	private OAuthIdentity exchangeGoogle(OAuthSetting setting, String code, OAuthFlowTransaction transaction) {
		OAuthSetting.GoogleClient client = setting.getGoogle();
		MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
		body.add("code", code);
		body.add("client_id", client.getClientId());
		body.add("client_secret", client.getClientSecret());
		body.add("redirect_uri", callbackUrl(setting, "google"));
		body.add("grant_type", "authorization_code");
		body.add("code_verifier", transaction.codeVerifier);
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
		Map<String, Object> tokenResponse;
		try {
			ResponseEntity<Map<String, Object>> response = restTemplate.exchange(GOOGLE_TOKEN_URL, HttpMethod.POST,
					new HttpEntity<MultiValueMap<String, String>>(body, headers),
					new ParameterizedTypeReference<Map<String, Object>>() {
					});
			tokenResponse = response.getBody();
		}
		catch (RestClientException ex) {
			throw new OAuthFlowException("provider_error");
		}
		String idToken = stringValue(tokenResponse, "id_token");
		if (!StringUtils.isNotBlank(idToken)) {
			throw new OAuthFlowException("provider_error");
		}
		try {
			Jwt jwt = googleJwtDecoder.decode(idToken);
			String issuer = jwt.getIssuer() == null ? null : jwt.getIssuer().toString();
			boolean issuerValid = GOOGLE_ISSUER.equals(issuer) || "accounts.google.com".equals(issuer);
			String azp = jwt.getClaimAsString("azp");
			if (!issuerValid || !jwt.getAudience().contains(client.getClientId())
					|| (StringUtils.isNotBlank(azp) && !client.getClientId().equals(azp))
					|| !constantTimeEquals(transaction.nonce, jwt.getClaimAsString("nonce"))
					|| !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))
					|| !StringUtils.isNotBlank(jwt.getSubject())) {
				throw new OAuthFlowException("invalid_identity");
			}
			return new OAuthIdentity(AppConsts.AUTH_TYPE.GOOGLE.name(), jwt.getSubject(), null, null,
					jwt.getClaimAsString("name"), jwt.getClaimAsString("picture"), jwt.getClaimAsString("email"));
		}
		catch (JwtException ex) {
			throw new OAuthFlowException("invalid_identity");
		}
	}

	private OAuthIdentity exchangeWechat(OAuthSetting setting, String channel, String code,
			boolean collectWechatUserInfo) {
		OAuthSetting.WechatClient client = "wechat-web".equals(channel) ? setting.getWechatWeb()
				: setting.getWechatOfficial();
		URI tokenUri = UriComponentsBuilder.fromHttpUrl(WECHAT_TOKEN_URL).queryParam("appid", client.getAppId())
				.queryParam("secret", client.getAppSecret()).queryParam("code", code)
				.queryParam("grant_type", "authorization_code").build().encode().toUri();
		Map<String, Object> token;
		try {
			token = getWechatJson(tokenUri);
		}
		catch (RestClientException | JsonProcessingException ex) {
			LOGGER.warn("WeChat OAuth token request failed, channel={}, exception={}", channel,
					ex.getClass().getSimpleName());
			throw new OAuthFlowException("provider_error");
		}
		if (token == null) {
			throw new OAuthFlowException("provider_error");
		}
		if (token.containsKey("errcode")) {
			String providerCode = stringValue(token, "errcode");
			LOGGER.warn("WeChat OAuth token exchange rejected, channel={}, errcode={}", channel, providerCode);
			throw new OAuthFlowException(wechatProviderError(providerCode));
		}
		String openId = stringValue(token, "openid");
		String unionId = stringValue(token, "unionid");
		String accessToken = stringValue(token, "access_token");
		String nickname = null;
		String avatarUrl = null;
		if ((collectWechatUserInfo || !StringUtils.isNotBlank(unionId)) && StringUtils.isNotBlank(openId)
				&& StringUtils.isNotBlank(accessToken)) {
			URI userInfoUri = UriComponentsBuilder.fromHttpUrl(WECHAT_USERINFO_URL)
					.queryParam("access_token", accessToken).queryParam("openid", openId).queryParam("lang", "zh_CN")
					.build().encode().toUri();
			try {
				Map<String, Object> userInfo = getWechatJson(userInfoUri);
				if (userInfo != null && !userInfo.containsKey("errcode")) {
					unionId = stringValue(userInfo, "unionid");
					nickname = stringValue(userInfo, "nickname");
					avatarUrl = stringValue(userInfo, "headimgurl");
				}
				else if (collectWechatUserInfo) {
					throw new OAuthFlowException("provider_error");
				}
			}
			catch (RestClientException | JsonProcessingException ex) {
				if (collectWechatUserInfo) {
					throw new OAuthFlowException("provider_error");
				}
				// OpenID remains a valid provider-scoped fallback for login and binding.
			}
		}
		else if (collectWechatUserInfo) {
			throw new OAuthFlowException("invalid_identity");
		}
		if (StringUtils.isNotBlank(unionId)) {
			String fallbackAccount = StringUtils.isNotBlank(openId) ? "openid:" + client.getAppId() + ":" + openId
					: null;
			return new OAuthIdentity(AppConsts.AUTH_TYPE.WECHAT.name(), "unionid:" + unionId, fallbackAccount, openId,
					nickname, avatarUrl, null);
		}
		if (!StringUtils.isNotBlank(openId)) {
			throw new OAuthFlowException("invalid_identity");
		}
		return new OAuthIdentity(AppConsts.AUTH_TYPE.WECHAT.name(), "openid:" + client.getAppId() + ":" + openId, null,
				openId, nickname, avatarUrl, null);
	}

	private Account resolveIdentityAccount(OAuthIdentity identity) {
		Account primary = selectIdentityAccount(identity.authType, identity.account);
		Account fallback = identity.fallbackAccount == null ? null
				: selectIdentityAccount(identity.authType, identity.fallbackAccount);
		if (primary != null && fallback != null && !StringUtils.equals(primary.getUserId(), fallback.getUserId())) {
			throw new OAuthFlowException("identity_conflict");
		}
		return primary != null ? primary : fallback;
	}

	private Account selectIdentityAccount(String authType, String account) {
		return accountMapper.selectOne(Wrappers.<Account>lambdaQuery().eq(Account::getAuthType, authType)
				.apply("BINARY auth_account = {0}", account));
	}

	private String buildGoogleAuthorizationUrl(OAuthSetting.GoogleClient client, String callback,
			OAuthFlowTransaction transaction) {
		return UriComponentsBuilder.fromHttpUrl(GOOGLE_AUTHORIZATION_URL).queryParam("client_id", client.getClientId())
				.queryParam("redirect_uri", callback).queryParam("response_type", "code")
				.queryParam("scope", "openid email profile").queryParam("state", transaction.state)
				.queryParam("nonce", transaction.nonce).queryParam("code_challenge", sha256(transaction.codeVerifier))
				.queryParam("code_challenge_method", "S256").build().encode().toUriString();
	}

	private String buildWechatOfficialAuthorizationUrl(OAuthSetting.WechatClient client, String callback, String state,
			String scope) {
		return UriComponentsBuilder.fromHttpUrl(WECHAT_OFFICIAL_AUTHORIZATION_URL)
				.queryParam("appid", client.getAppId()).queryParam("redirect_uri", callback)
				.queryParam("response_type", "code").queryParam("scope", scope).queryParam("state", state)
				.fragment("wechat_redirect").build().encode().toUriString();
	}

	private void ensureChannelEnabled(OAuthSetting setting, String channel) {
		if (setting == null || !StringUtils.isNotBlank(setting.getPublicBaseUrl())) {
			throw new ValidationException("第三方登录未配置");
		}
		if ("google".equals(channel)) {
			OAuthSetting.GoogleClient client = setting.getGoogle();
			if (client == null || !Boolean.TRUE.equals(client.getEnabled())
					|| !StringUtils.isNotBlank(client.getClientId())
					|| !StringUtils.isNotBlank(client.getClientSecret())) {
				throw new ValidationException("Google 登录未配置");
			}
			return;
		}
		OAuthSetting.WechatClient client = "wechat-web".equals(channel) ? setting.getWechatWeb()
				: setting.getWechatOfficial();
		if (client == null || !Boolean.TRUE.equals(client.getEnabled()) || !StringUtils.isNotBlank(client.getAppId())
				|| !StringUtils.isNotBlank(client.getAppSecret())) {
			throw new ValidationException("微信登录未配置");
		}
	}

	private OAuthCallbackResult failure(OAuthFlowTransaction transaction, String error) {
		String redirect;
		if (transaction.surveyWechat) {
			redirect = UriComponentsBuilder.fromUriString(transaction.redirect)
					.replaceQueryParam("wechatAuthError", error).build().encode().toUriString();
		}
		else if (transaction.login) {
			redirect = loginErrorRedirect(error, transaction.redirect);
		}
		else if ("session_expired".equals(error)) {
			redirect = loginErrorRedirect(error, "/account/settings?tab=security");
		}
		else {
			redirect = "/account/settings?tab=security&oauthBind=error&oauthError=" + urlEncode(error);
		}
		return OAuthCallbackResult.failure(transaction.login, error, redirect);
	}

	private String loginErrorRedirect(String error, String redirect) {
		return UriComponentsBuilder.fromPath("/user/login").queryParam("oauthError", error)
				.queryParam("redirect", safeRedirect(redirect, "/")).build().encode().toUriString();
	}

	private String callbackUrl(OAuthSetting setting, String channel) {
		return setting.getPublicBaseUrl() + "/api/public/oauth/callback/" + channel;
	}

	private String safeRedirect(String redirect, String fallback) {
		if (!StringUtils.isNotBlank(redirect) || !redirect.startsWith("/") || redirect.startsWith("//")
				|| redirect.indexOf('\\') >= 0 || redirect.indexOf('\r') >= 0 || redirect.indexOf('\n') >= 0) {
			return fallback;
		}
		try {
			URI uri = URI.create(redirect);
			return uri.isAbsolute() || uri.getHost() != null ? fallback : redirect;
		}
		catch (IllegalArgumentException ex) {
			return fallback;
		}
	}

	private Cache flowCache() {
		Cache cache = cacheManager.getCache(CacheConsts.oauthFlowCacheName);
		if (cache == null) {
			throw new IllegalStateException("OAuth flow cache is not configured");
		}
		return cache;
	}

	private String randomToken() {
		byte[] bytes = new byte[32];
		secureRandom.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	private String sha256(String value) {
		try {
			return Base64.getUrlEncoder().withoutPadding().encodeToString(
					MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.US_ASCII)));
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException("SHA-256 is unavailable", ex);
		}
	}

	private boolean constantTimeEquals(String expected, String actual) {
		if (expected == null || actual == null) {
			return false;
		}
		return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
				actual.getBytes(StandardCharsets.UTF_8));
	}

	private String stringValue(Map<String, Object> values, String key) {
		Object value = values == null ? null : values.get(key);
		return value == null ? null : String.valueOf(value);
	}

	private Map<String, Object> getWechatJson(URI uri) throws JsonProcessingException {
		String body = restTemplate.exchange(uri, HttpMethod.GET, HttpEntity.EMPTY, String.class).getBody();
		return StringUtils.isNotBlank(body) ? objectMapper.readValue(body, JSON_MAP_TYPE) : null;
	}

	private String wechatProviderError(String providerCode) {
		if (!StringUtils.isNotBlank(providerCode) || !providerCode.matches("\\d+")) {
			return "provider_error";
		}
		return "wechat_error_" + providerCode;
	}

	private String extractWechatAppId(String account) {
		if (account == null || !account.startsWith("openid:")) {
			return null;
		}
		int separator = account.indexOf(':', "openid:".length());
		return separator > 0 ? account.substring("openid:".length(), separator) : null;
	}

	private boolean isWechat(String userAgent) {
		return StringUtils.defaultString(userAgent).toLowerCase(Locale.ROOT).contains("micromessenger");
	}

	private String urlEncode(String value) {
		try {
			return URLEncoder.encode(StringUtils.defaultString(value), "UTF-8");
		}
		catch (Exception ex) {
			throw new IllegalStateException("UTF-8 is unavailable", ex);
		}
	}

	private static final class OAuthFlowTransaction {

		private String state;

		private String flowCookie;

		private boolean login;

		private boolean surveyWechat;

		private boolean collectWechatUserInfo;

		private String projectId;

		private String userId;

		private String channel;

		private String redirect;

		private String nonce;

		private String codeVerifier;

	}

	private static final class OAuthRegistrationTransaction {

		private OAuthIdentity identity;

		private String redirect;

	}

	private static final class OAuthIdentity {

		private final String authType;

		private final String account;

		private final String fallbackAccount;

		private final String openId;

		private final String nickname;

		private final String avatarUrl;

		private final String email;

		private OAuthIdentity(String authType, String account, String fallbackAccount, String openId, String nickname,
				String avatarUrl, String email) {
			this.authType = authType;
			this.account = account;
			this.fallbackAccount = fallbackAccount;
			this.openId = openId;
			this.nickname = nickname;
			this.avatarUrl = avatarUrl;
			this.email = email;
		}

	}

	private static final class OAuthFlowException extends RuntimeException {

		private final String error;

		private OAuthFlowException(String error) {
			this.error = error;
		}

	}

}
