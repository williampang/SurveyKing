package cn.surveyking.server.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 微信问卷授权身份。该对象只保存在服务端签名的 HttpOnly Cookie 中。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SurveyWechatIdentity {

	private String projectId;

	private String openId;

	private String nickname;

	private String avatarUrl;

	private boolean userInfoCollected;

}
