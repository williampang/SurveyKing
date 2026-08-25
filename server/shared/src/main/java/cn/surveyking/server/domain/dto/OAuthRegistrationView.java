package cn.surveyking.server.domain.dto;

import lombok.Data;

/** Public values used to prefill the OAuth registration form. */
@Data
public class OAuthRegistrationView {

	private String name;

	private String username;

}
