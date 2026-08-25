package cn.surveyking.server.core.security;

import cn.surveyking.server.core.constant.AppConsts;
import cn.surveyking.server.domain.dto.UserTokenView;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import javax.servlet.http.HttpServletRequest;

@Component
@RequiredArgsConstructor
public class AuthenticationCookieService {

	private final JwtTokenUtil jwtTokenUtil;

	public String createToken(String userId) {
		return jwtTokenUtil.generateAccessToken(new UserTokenView(userId));
	}

	public ResponseCookie createCookie(String token, HttpServletRequest request) {
		return ResponseCookie.from(AppConsts.TOKEN_NAME, token).path("/").httpOnly(true).secure(isSecure(request))
				.sameSite("Lax").build();
	}

	public ResponseCookie clearCookie(HttpServletRequest request) {
		return ResponseCookie.from(AppConsts.TOKEN_NAME, "").path("/").httpOnly(true).secure(isSecure(request))
				.sameSite("Lax").maxAge(0).build();
	}

	public boolean isSecure(HttpServletRequest request) {
		return request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
	}

}
