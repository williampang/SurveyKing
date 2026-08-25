package cn.surveyking.server.domain.dto;

import lombok.Data;

/**
 * 当前用户可自行修改的个人资料。
 *
 * @author javahuang
 */
@Data
public class UserProfileRequest {

	private String name;

	private String avatar;

	private String profile;

	private String phone;

	private String email;

	private String gender;

	private Integer correctTimes;

	private String password;

	private String oldPassword;

}
