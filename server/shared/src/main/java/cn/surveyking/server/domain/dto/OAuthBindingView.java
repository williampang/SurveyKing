package cn.surveyking.server.domain.dto;

import lombok.Data;

@Data
public class OAuthBindingView {

	private String id;

	private String provider;

	private String channel;

	private boolean coversWeb;

	private boolean coversOfficial;

}
