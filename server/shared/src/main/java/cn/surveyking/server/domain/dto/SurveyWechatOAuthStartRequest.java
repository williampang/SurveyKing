package cn.surveyking.server.domain.dto;

import lombok.Data;

@Data
public class SurveyWechatOAuthStartRequest {

	private String projectId;

	private String redirect;

}
