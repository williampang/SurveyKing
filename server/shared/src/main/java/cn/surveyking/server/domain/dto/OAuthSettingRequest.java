package cn.surveyking.server.domain.dto;

import lombok.Data;

/** Admin request for updating OAuth settings. */
@Data
public class OAuthSettingRequest {

	private String publicBaseUrl;

	private GoogleClient google;

	private WechatClient wechatWeb;

	private WechatClient wechatOfficial;

	@Data
	public static class GoogleClient {

		private Boolean enabled;

		private String clientId;

		private String clientSecret;

		private Boolean clearSecret;

		@Override
		public String toString() {
			return "GoogleClient(enabled=" + enabled + ", clientId=" + clientId
					+ ", clientSecret=<redacted>, clearSecret=" + clearSecret + ")";
		}

	}

	@Data
	public static class WechatClient {

		private Boolean enabled;

		private String appId;

		private String appSecret;

		private Boolean clearSecret;

		@Override
		public String toString() {
			return "WechatClient(enabled=" + enabled + ", appId=" + appId + ", appSecret=<redacted>, clearSecret="
					+ clearSecret + ")";
		}

	}

}
