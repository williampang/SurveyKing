package cn.surveyking.server.core.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;

/**
 * Bounds repeated password guesses for an account from the same client address.
 */
@Component
public class LoginAttemptLimiter {

	private static final int MAX_FAILURES = 10;

	private final Cache<String, Integer> failures = Caffeine.newBuilder().maximumSize(10_000)
			.expireAfterWrite(Duration.ofMinutes(10)).build();

	public boolean isAllowed(String username, String clientAddress) {
		Integer failureCount = failures.getIfPresent(key(username, clientAddress));
		return failureCount == null || failureCount < MAX_FAILURES;
	}

	public void recordFailure(String username, String clientAddress) {
		failures.asMap().compute(key(username, clientAddress), (key, count) -> count == null ? 1 : count + 1);
	}

	public void recordSuccess(String username, String clientAddress) {
		failures.invalidate(key(username, clientAddress));
	}

	private String key(String username, String clientAddress) {
		String normalizedUsername = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
		return normalizedUsername + '|' + (clientAddress == null ? "" : clientAddress);
	}

}
