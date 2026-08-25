package cn.surveyking.server.core.security;

import cn.surveyking.server.domain.dto.SurveyWechatIdentity;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.util.WebUtils;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import java.time.Duration;

@Component
@RequiredArgsConstructor
public class SurveyWechatCookieService {

	public static final String COOKIE_NAME = "sk-survey-wechat";

	private final JwtTokenUtil jwtTokenUtil;

	public String createToken(SurveyWechatIdentity identity) {
		return jwtTokenUtil.generateSurveyWechatToken(identity);
	}

	public SurveyWechatIdentity resolve(HttpServletRequest request) {
		if (request == null) {
			return null;
		}
		Cookie cookie = WebUtils.getCookie(request, COOKIE_NAME);
		if (cookie == null || !jwtTokenUtil.validate(cookie.getValue())) {
			return null;
		}
		try {
			return jwtTokenUtil.getSurveyWechatIdentity(cookie.getValue());
		}
		catch (RuntimeException ex) {
			return null;
		}
	}

	public ResponseCookie createCookie(String token, HttpServletRequest request) {
		return ResponseCookie.from(COOKIE_NAME, token).path("/").httpOnly(true).secure(isSecure(request))
				.sameSite("Lax").maxAge(Duration.ofHours(8)).build();
	}

	private boolean isSecure(HttpServletRequest request) {
		return request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
	}

}
