package cn.surveyking.server.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Public OAuth provider availability. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OAuthProviderAvailability {

	private boolean google;

	private boolean wechatWeb;

	private boolean wechatOfficial;

}
