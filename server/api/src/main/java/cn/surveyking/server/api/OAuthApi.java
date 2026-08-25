package cn.surveyking.server.api;

import cn.surveyking.server.core.security.AuthenticationCookieService;
import cn.surveyking.server.core.security.SurveyWechatCookieService;
import cn.surveyking.server.core.uitls.SecurityContextUtils;
import cn.surveyking.server.domain.dto.OAuthBindingView;
import cn.surveyking.server.domain.dto.OAuthCallbackResult;
import cn.surveyking.server.domain.dto.OAuthRegistrationResult;
import cn.surveyking.server.domain.dto.OAuthRegistrationView;
import cn.surveyking.server.domain.dto.OAuthStartRequest;
import cn.surveyking.server.domain.dto.OAuthStartResponse;
import cn.surveyking.server.domain.dto.RegisterRequest;
import cn.surveyking.server.domain.dto.SurveyWechatOAuthStartRequest;
import cn.surveyking.server.service.OAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.WebUtils;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.net.URI;
import java.time.Duration;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("${api.prefix}")
public class OAuthApi {

	private static final String FLOW_COOKIE = "sk-oauth-flow";

	private final OAuthService oauthService;

	private final AuthenticationCookieService authenticationCookieService;

	private final SurveyWechatCookieService surveyWechatCookieService;

	@PostMapping("/public/oauth/login/{provider}/start")
	public ResponseEntity<OAuthStartResponse> startLogin(@PathVariable String provider,
			@RequestBody(required = false) OAuthStartRequest request, HttpServletRequest httpRequest) {
		OAuthStartResponse result = oauthService.startLogin(provider, request == null ? null : request.getRedirect(),
				httpRequest.getHeader(HttpHeaders.USER_AGENT));
		return startResponse(result, httpRequest);
	}

	@PostMapping("/oauth/bind/{provider}/start")
	@PreAuthorize("isAuthenticated()")
	public ResponseEntity<OAuthStartResponse> startBind(@PathVariable String provider,
			@RequestBody(required = false) OAuthStartRequest request, HttpServletRequest httpRequest) {
		OAuthStartResponse result = oauthService.startBind(provider, request == null ? null : request.getRedirect(),
				httpRequest.getHeader(HttpHeaders.USER_AGENT), SecurityContextUtils.getUserId());
		return startResponse(result, httpRequest);
	}

	@PostMapping("/public/oauth/survey/wechat/start")
	public ResponseEntity<OAuthStartResponse> startSurveyWechat(@RequestBody SurveyWechatOAuthStartRequest request,
			HttpServletRequest httpRequest) {
		OAuthStartResponse result = oauthService.startSurveyWechat(request.getProjectId(), request.getRedirect(),
				httpRequest.getHeader(HttpHeaders.USER_AGENT));
		return startResponse(result, httpRequest);
	}

	@GetMapping("/public/oauth/callback/{channel}")
	public ResponseEntity<Void> callback(@PathVariable String channel, @RequestParam(required = false) String code,
			@RequestParam(required = false) String state, @RequestParam(required = false, name = "error") String error,
			HttpServletRequest request) {
		Cookie cookie = WebUtils.getCookie(request, FLOW_COOKIE);
		String currentUserId = SecurityContextUtils.isAuthenticated() ? SecurityContextUtils.getUserId() : null;
		OAuthCallbackResult result = oauthService.handleCallback(channel, code, state, error,
				cookie == null ? null : cookie.getValue(), currentUserId);
		ResponseEntity.BodyBuilder response = ResponseEntity.status(HttpStatus.FOUND)
				.location(URI.create(result.getRedirectUrl()))
				.header(HttpHeaders.SET_COOKIE, clearFlowCookie(request).toString());
		if (result.isLogin() && result.getError() == null) {
			String token = authenticationCookieService.createToken(result.getUserId());
			response.header(HttpHeaders.SET_COOKIE,
					authenticationCookieService.createCookie(token, request).toString());
		}
		if (result.getSurveyWechatIdentity() != null && result.getError() == null) {
			String token = surveyWechatCookieService.createToken(result.getSurveyWechatIdentity());
			response.header(HttpHeaders.SET_COOKIE, surveyWechatCookieService.createCookie(token, request).toString());
		}
		return response.build();
	}

	@GetMapping("/public/oauth/register/{ticket}")
	public OAuthRegistrationView registration(@PathVariable String ticket) {
		return oauthService.getRegistration(ticket);
	}

	@PostMapping("/public/oauth/register/{ticket}")
	public ResponseEntity<OAuthRegistrationResult> completeRegistration(@PathVariable String ticket,
			@RequestBody @Valid RegisterRequest request, HttpServletRequest httpRequest) {
		OAuthCallbackResult result = oauthService.completeRegistration(ticket, request);
		String token = authenticationCookieService.createToken(result.getUserId());
		OAuthRegistrationResult response = new OAuthRegistrationResult();
		response.setRedirectUrl(result.getRedirectUrl());
		return ResponseEntity.ok()
				.header(HttpHeaders.SET_COOKIE, authenticationCookieService.createCookie(token, httpRequest).toString())
				.header(HttpHeaders.AUTHORIZATION, token).body(response);
	}

	@GetMapping("/oauth/bindings")
	@PreAuthorize("isAuthenticated()")
	public List<OAuthBindingView> bindings() {
		return oauthService.getBindings(SecurityContextUtils.getUserId());
	}

	@DeleteMapping("/oauth/bindings/{bindingId}")
	@PreAuthorize("isAuthenticated()")
	public void unbind(@PathVariable String bindingId) {
		oauthService.unbind(bindingId, SecurityContextUtils.getUserId());
	}

	private ResponseEntity<OAuthStartResponse> startResponse(OAuthStartResponse result, HttpServletRequest request) {
		ResponseCookie cookie = ResponseCookie.from(FLOW_COOKIE, result.getFlowCookie())
				.path("/api/public/oauth/callback").httpOnly(true).secure(authenticationCookieService.isSecure(request))
				.sameSite("Lax").maxAge(Duration.ofMinutes(10)).build();
		return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(result);
	}

	private ResponseCookie clearFlowCookie(HttpServletRequest request) {
		return ResponseCookie.from(FLOW_COOKIE, "").path("/api/public/oauth/callback").httpOnly(true)
				.secure(authenticationCookieService.isSecure(request)).sameSite("Lax").maxAge(0).build();
	}

}
