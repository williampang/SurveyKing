package cn.surveyking.server.domain.dto;

import lombok.Data;

/** Internal result used by the OAuth callback controller. */
@Data
public class OAuthCallbackResult {

	private boolean login;

	private String userId;

	private String redirectUrl;

	private String error;

	private SurveyWechatIdentity surveyWechatIdentity;

	public static OAuthCallbackResult success(boolean login, String userId, String redirectUrl) {
		OAuthCallbackResult result = new OAuthCallbackResult();
		result.setLogin(login);
		result.setUserId(userId);
		result.setRedirectUrl(redirectUrl);
		return result;
	}

	public static OAuthCallbackResult failure(boolean login, String error, String redirectUrl) {
		OAuthCallbackResult result = new OAuthCallbackResult();
		result.setLogin(login);
		result.setError(error);
		result.setRedirectUrl(redirectUrl);
		return result;
	}

	public static OAuthCallbackResult pendingRegistration(String redirectUrl) {
		OAuthCallbackResult result = new OAuthCallbackResult();
		result.setRedirectUrl(redirectUrl);
		return result;
	}

	public static OAuthCallbackResult surveyWechatSuccess(SurveyWechatIdentity identity, String redirectUrl) {
		OAuthCallbackResult result = new OAuthCallbackResult();
		result.setRedirectUrl(redirectUrl);
		result.setSurveyWechatIdentity(identity);
		return result;
	}

}
