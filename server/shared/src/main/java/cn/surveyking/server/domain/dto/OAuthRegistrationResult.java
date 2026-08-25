package cn.surveyking.server.domain.dto;

import lombok.Data;

/** Result returned after an OAuth user completes registration. */
@Data
public class OAuthRegistrationResult {

	private String redirectUrl;

}
