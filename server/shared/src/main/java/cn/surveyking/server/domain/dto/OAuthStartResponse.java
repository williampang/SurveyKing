package cn.surveyking.server.domain.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

@Data
public class OAuthStartResponse {

	private String mode;

	private String authorizationUrl;

	private WechatQr qr;

	@JsonIgnore
	private String flowCookie;

	@Data
	public static class WechatQr {

		private String appId;

		private String scope;

		private String redirectUri;

		private String state;

	}

}
