package cn.surveyking.server.service;

import cn.surveyking.server.domain.dto.OAuthBindingView;
import cn.surveyking.server.domain.dto.OAuthCallbackResult;
import cn.surveyking.server.domain.dto.OAuthRegistrationView;
import cn.surveyking.server.domain.dto.OAuthStartResponse;
import cn.surveyking.server.domain.dto.RegisterRequest;

import java.util.List;

public interface OAuthService {

	OAuthStartResponse startLogin(String provider, String redirect, String userAgent);

	OAuthStartResponse startBind(String provider, String redirect, String userAgent, String userId);

	OAuthStartResponse startSurveyWechat(String projectId, String redirect, String userAgent);

	OAuthCallbackResult handleCallback(String channel, String code, String state, String providerError,
			String flowCookie, String currentUserId);

	OAuthRegistrationView getRegistration(String ticket);

	OAuthCallbackResult completeRegistration(String ticket, RegisterRequest request);

	List<OAuthBindingView> getBindings(String userId);

	void unbind(String bindingId, String userId);

}
