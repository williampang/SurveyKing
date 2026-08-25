package cn.surveyking.server.api;

import cn.surveyking.server.core.common.PaginationResponse;
import cn.surveyking.server.core.constant.ErrorCode;
import cn.surveyking.server.core.exception.ErrorCodeException;
import cn.surveyking.server.core.security.LoginAttemptLimiter;
import cn.surveyking.server.core.security.AuthenticationCookieService;
import cn.surveyking.server.core.uitls.RSAUtils;
import cn.surveyking.server.core.uitls.SecurityContextUtils;
import cn.surveyking.server.domain.dto.*;
import cn.surveyking.server.service.UserService;
import com.anji.captcha.model.common.ResponseModel;
import com.anji.captcha.model.vo.CaptchaVO;
import com.anji.captcha.service.CaptchaService;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.List;
import java.util.Optional;

/**
 * @author javahuang
 * @date 2021/10/12
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("${api.prefix}")
public class UserApi {

	private final UserService userService;

	private final AuthenticationManager authenticationManager;

	private final AuthenticationCookieService authenticationCookieService;

	private final LoginAttemptLimiter loginAttemptLimiter;

	@PostMapping("/public/login")
	public ResponseEntity login(@RequestBody @Valid AuthRequest request, HttpServletRequest httpRequest) {
		userService.validateCaptcha(request);
		String clientAddress = httpRequest.getRemoteAddr();
		if (!loginAttemptLimiter.isAllowed(request.getUsername(), clientAddress)) {
			throw new ErrorCodeException(ErrorCode.UsernameOrPasswordError);
		}
		Authentication authentication;
		try {
			String decryptPwd = RSAUtils.decrypt(request.getPassword());
			authentication = new UsernamePasswordAuthenticationToken(request.getUsername(), decryptPwd);
			Authentication authenticate = authenticationManager.authenticate(authentication);
			UserInfo user = (UserInfo) authenticate.getPrincipal();
			loginAttemptLimiter.recordSuccess(request.getUsername(), clientAddress);
			String token = authenticationCookieService.createToken(user.getUserId());
			HttpCookie cookie = authenticationCookieService.createCookie(token, httpRequest);
			return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString())
					.header(HttpHeaders.AUTHORIZATION, token).build();
		}
		catch (Exception e) {
			loginAttemptLimiter.recordFailure(request.getUsername(), clientAddress);
			throw new ErrorCodeException(ErrorCode.UsernameOrPasswordError);
		}
	}

	@PostMapping("/public/logout")
	public ResponseEntity logout(HttpServletRequest httpRequest) {
		HttpCookie cookie = authenticationCookieService.clearCookie(httpRequest);
		return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).build();
	}

	@PostMapping("/public/register")
	public void register(@RequestBody RegisterRequest request) {
		userService.register(request);
	}

	@GetMapping("/currentUser")
	@PreAuthorize("isAuthenticated()")
	public UserInfo currentUser() {
		return userService.loadUserById(SecurityContextUtils.getUserId());
	}

	@GetMapping("/userOverview")
	@PreAuthorize("isAuthenticated()")
	public UserOverview userOverview() {
		return userService.getUserOverviewData();
	}

	@PostMapping("/user")
	@PreAuthorize("hasAuthority('user:update')")
	public UserInfo updateUser(@RequestBody UserProfileRequest request) {
		String userId = SecurityContextUtils.getUserId();
		userService.updateUserProfile(userId, request);
		return userService.loadUserById(SecurityContextUtils.getUserId());
	}

	@GetMapping("/public/listRegisterRole")
	public List<RegisterRoleView> getRegisterRoles() {
		return userService.getRegisterRoles();
	}

	/**
	 * 导入用户
	 * @param request
	 */
	@PostMapping("/importUser")
	@PreAuthorize("hasAuthority('system:user:create')")
	public void importUser(UserRequest request) {
		userService.importUser(request);
	}

	/**
	 * 查询用户任务
	 * @param query
	 * @return
	 */
	@GetMapping("/listUserTask")
	@PreAuthorize("hasAuthority('home')")
	public PaginationResponse<MyTaskView> myTask(MyTaskQuery query) {
		return userService.queryTask(query);
	}

	/**
	 * 查询历史任务
	 * @param query
	 * @return
	 */
	@GetMapping("/listHistoryTask")
	public PaginationResponse<MyTaskView> myHistoryTask(MyTaskQuery query) {
		return userService.queryHistoryTask(query);
	}

}
