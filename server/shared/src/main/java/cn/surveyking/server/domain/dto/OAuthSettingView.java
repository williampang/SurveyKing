package cn.surveyking.server.domain.dto;

import lombok.Data;

/** Admin-facing OAuth settings with secrets removed. */
@Data
public class OAuthSettingView {

	private String publicBaseUrl;

	private GoogleClient google;

	private WechatClient wechatWeb;

	private WechatClient wechatOfficial;

	@Data
	public static class GoogleClient {

		private Boolean enabled;

		private String clientId;

		private Boolean secretConfigured;

	}

	@Data
	public static class WechatClient {

		private Boolean enabled;

		private String appId;

		private Boolean secretConfigured;

	}

}
