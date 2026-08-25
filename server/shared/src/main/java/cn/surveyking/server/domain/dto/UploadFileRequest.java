package cn.surveyking.server.domain.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

/**
 * @author javahuang
 * @date 2022/5/5
 */
@Data
public class UploadFileRequest {

	/**
	 * 同一个问卷内的附件存放到同一个文件夹，basePath 为问卷 id
	 */
	private String basePath;

	private MultipartFile file;

	private int fileType;

	private String id;

	private String projectId;

	private String questionId;

	/**
	 * 是否允许通过公开预览接口访问。仅对已认证的后台上传生效。
	 */
	private Boolean publicRead;

	@JsonIgnore
	public Boolean publicUpload;

}
