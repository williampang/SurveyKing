package cn.surveyking.server.ai.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.SneakyThrows;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StreamUtils;
import org.springframework.util.StringUtils;
import cn.surveyking.server.ai.domain.ChatRequest;
import cn.surveyking.server.ai.domain.ConversationRequest;
import cn.surveyking.server.ai.domain.ConversationResponse;
import cn.surveyking.server.ai.domain.ModelType;
import cn.surveyking.server.ai.domain.StreamResponseEvent;
import cn.surveyking.server.ai.domain.AiMessage;
import cn.surveyking.server.ai.domain.EventTypeEnum;
import cn.surveyking.server.ai.service.AiChatService;
import cn.surveyking.server.service.SystemService;
import cn.surveyking.server.domain.dto.SystemInfo;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.function.Consumer;
import java.util.stream.Collectors;

import lombok.extern.slf4j.Slf4j;
import reactor.util.retry.Retry;

/**
 * OpenAI-compatible chat service. The API base URL, key, model list and default model are
 * managed through system settings.
 *
 * @author zzr
 */
@Slf4j
@Service
public class OpenAiCompatibleChatServiceImpl implements AiChatService {

	private final WebClient webClient;

	private final ObjectMapper objectMapper;

	private final SystemService systemService;

	private static final String DEFAULT_BASE_URL = "https://api.openai.com/v1";

	private static final String LEGACY_SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";

	private static final String OUTPUT_LANGUAGE_INSTRUCTION = String.join("\n", "Output language requirement:",
			"Generate all user-facing survey or exam content in %s.",
			"This includes titles, welcome text, question text, options, fill-in answers, and answer explanations.",
			"The language requirement overrides the language used by examples in the base prompt.",
			"Keep all parser syntax unchanged. In particular, never translate text enclosed in 【】 or these literal markers:",
			"（正确答案） and 答案解析：.",
			"Apart from those required parser markers, do not output Chinese placeholder or example content unless the target language is Chinese.");

	public OpenAiCompatibleChatServiceImpl(WebClient webClient, ObjectMapper objectMapper,
			SystemService systemService) {
		this.webClient = webClient;
		this.objectMapper = objectMapper;
		this.systemService = systemService;
	}

	/**
	 * 获取AI配置
	 */
	private SystemInfo.AiSetting getAiSetting() {
		SystemInfo.AiSetting aiSetting = systemService.getSystemAiSetting();
		if (aiSetting == null) {
			log.warn("AI setting is null, creating default setting");
			aiSetting = new SystemInfo.AiSetting();
			aiSetting.setEnabled(false);
		}
		return aiSetting;
	}

	@Override
	public boolean isEnabled() {
		SystemInfo.AiSetting aiSetting = getAiSetting();
		return aiSetting.getEnabled() != null && aiSetting.getEnabled();
	}

	@Override
	public List<ModelType> getSupportedModels() {
		SystemInfo.AiSetting aiSetting = getAiSetting();
		if (aiSetting.getModels() == null || aiSetting.getModels().isEmpty()) {
			return Collections.emptyList();
		}

		List<String> models = aiSetting.getModels().stream().filter(StringUtils::hasText).distinct()
				.collect(Collectors.toList());
		String defaultModel = resolveDefaultModel(aiSetting, models);
		if (StringUtils.hasText(defaultModel)) {
			models.remove(defaultModel);
			models.add(0, defaultModel);
		}

		return models.stream().map(model -> new ModelType(model, model, "OpenAI-compatible model: " + model))
				.collect(Collectors.toList());
	}

	@Override
	public ConversationResponse createConversation(ConversationRequest conversationRequest) {
		// 创建一个新的 ConversationResponse 对象
		ConversationResponse response = new ConversationResponse();
		response.setId(UUID.randomUUID().toString().replace("-", ""));
		response.setCreatedAt(System.currentTimeMillis());

		// 设置模型类型和ID
		Map<String, String> metaData = new HashMap<>();
		metaData.put("modelType", "openai-compatible");

		String requestedModel = conversationRequest != null && StringUtils.hasText(conversationRequest.getModel())
				? conversationRequest.getModel()
				: conversationRequest != null ? conversationRequest.getModelType() : null;
		String modelId = resolveModel(getAiSetting(), requestedModel);
		metaData.put("modelId", modelId != null ? modelId : "");
		response.setMetaData(metaData);

		return response;
	}

	@Override
	public Flux<StreamResponseEvent> createChatStream(ChatRequest chatRequest, String conversationId, String model,
			Consumer<AiMessage> consumer) {

		// 检查AI是否启用
		if (!isEnabled()) {
			return Flux.just(new StreamResponseEvent(EventTypeEnum.error, "AI功能未启用"));
		}

		SystemInfo.AiSetting aiSetting = getAiSetting();
		String apiKey = getApiKey(aiSetting);
		if (!StringUtils.hasText(apiKey)) {
			return Flux.just(new StreamResponseEvent(EventTypeEnum.error, "API Key未配置"));
		}

		String selectedModel = resolveModel(aiSetting, model);
		if (!StringUtils.hasText(selectedModel)) {
			return Flux.just(new StreamResponseEvent(EventTypeEnum.error, "没有可用的AI模型"));
		}

		String chatCompletionsUrl;
		try {
			chatCompletionsUrl = getChatCompletionsUrl(aiSetting);
		}
		catch (IllegalArgumentException e) {
			return Flux.just(new StreamResponseEvent(EventTypeEnum.error, e.getMessage()));
		}

		// 构建请求体
		Map<String, Object> requestBody = new HashMap<>();
		requestBody.put("model", selectedModel);
		requestBody.put("stream", true);

		// 构建消息列表
		List<Map<String, String>> messages = new ArrayList<>();

		// 添加系统 prompt 消息，题目解析等场景可覆盖默认提示词
		String systemPromptContent = chatRequest.getSystemPrompt();
		AiMessage prompt = StringUtils.hasText(systemPromptContent) ? null
				: getPrompt("openai-compatible", selectedModel);
		if (StringUtils.hasText(systemPromptContent)) {
			Map<String, String> systemMessage = new HashMap<>();
			systemMessage.put("role", "system");
			systemMessage.put("content", appendOutputLanguageInstruction(systemPromptContent, chatRequest.getLocale()));
			messages.add(systemMessage);
		}
		else if (prompt != null && prompt.getContent() != null) {
			Map<String, String> systemMessage = new HashMap<>();
			systemMessage.put("role", prompt.getRole());
			systemMessage.put("content",
					appendOutputLanguageInstruction(prompt.getContent(), chatRequest.getLocale()));
			messages.add(systemMessage);
		}

		// 添加历史消息（最多10条）
		List<ChatRequest.EnterMessage> historyMessages = chatRequest.getAdditionalMessages();
		if (historyMessages != null) {
			int startIndex = Math.max(0, historyMessages.size() - 10);
			for (int i = startIndex; i < historyMessages.size(); i++) {
				ChatRequest.EnterMessage msg = historyMessages.get(i);
				Map<String, String> historyMessage = new HashMap<>();
				historyMessage.put("role", msg.getRole() != null ? msg.getRole() : "user");
				historyMessage.put("content", msg.getContent());
				messages.add(historyMessage);
			}
		}

		requestBody.put("messages", messages);

		// 发送请求
		List<String> contentList = new ArrayList<>();
		return webClient.post().uri(chatCompletionsUrl).header("Authorization", "Bearer " + apiKey)
				.header("Content-Type", "application/json").bodyValue(requestBody).retrieve().bodyToFlux(String.class)
				.timeout(Duration.ofMinutes(5)).mapNotNull(original -> {
					log.info("AI response: {}", original);
					if ("[DONE]".equals(original)) {
						// 将所有的 content 保存到 AiMessage
						consumer.accept(new AiMessage(conversationId, "assistant", String.join("", contentList)));
						return new StreamResponseEvent(EventTypeEnum.done, "");
					}
					try {
						JsonNode jsonObject = objectMapper.readTree(original);
						JsonNode delta = jsonObject.path("choices").get(0).path("delta");

						// 处理DeepSeek的推理内容（如果存在）
						String reasoningData = delta.path("reasoning_content").asText(null);
						if (StringUtils.hasText(reasoningData)) {
							return new StreamResponseEvent(EventTypeEnum.in_progress, "", reasoningData);
						}

						String content = delta.path("content").asText(null);
						if (content != null) {
							contentList.add(content);
							return new StreamResponseEvent(EventTypeEnum.in_progress, content);
						}
						return null;
					}
					catch (Exception e) {
						log.error("Failed to parse response: {}", original, e);
						return null;
					}
				}).filter(Objects::nonNull).onErrorResume(e -> {
					if (e instanceof WebClientResponseException) {
						WebClientResponseException wre = (WebClientResponseException) e;
						log.error("HTTP error: {} - {}", wre.getStatusCode(), wre.getResponseBodyAsString());
						return Flux.just(
								new StreamResponseEvent(EventTypeEnum.error, "HTTP error: " + wre.getStatusCode()));
					}
					else {
						log.error("Network error", e);
						return Flux
								.just(new StreamResponseEvent(EventTypeEnum.error, "Network error: " + e.getMessage()));
					}
				}).retryWhen(Retry.backoff(3, Duration.ofSeconds(1)))
				.concatWith(Flux.just(new StreamResponseEvent(EventTypeEnum.done, "")));
	}

	@Override
	@SneakyThrows
	public AiMessage getPrompt(String modelType, String modelId) {
		SystemInfo.AiSetting aiSetting = getAiSetting();

		// 创建一个新的消息对象
		AiMessage message = new AiMessage();
		message.setRole("system");

		// 优先使用系统配置的提示词，如果没有则使用默认提示词
		String prompt = aiSetting.getPrompt();
		if (!StringUtils.hasText(prompt)) {
			ClassPathResource resource = new ClassPathResource("prompt/openai-compatible.md");
			prompt = StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
		}
		message.setContent(prompt);
		return message;
	}

	private String appendOutputLanguageInstruction(String basePrompt, String locale) {
		String outputLanguage = resolveOutputLanguage(locale);
		if (!StringUtils.hasText(basePrompt) || !StringUtils.hasText(outputLanguage)) {
			return basePrompt;
		}
		return basePrompt + "\n\n" + String.format(OUTPUT_LANGUAGE_INSTRUCTION, outputLanguage);
	}

	private String resolveOutputLanguage(String locale) {
		if (!StringUtils.hasText(locale)) {
			return null;
		}
		String normalizedLocale = locale.trim().replace('_', '-').toLowerCase(Locale.ROOT);
		switch (normalizedLocale) {
			case "zh-tw":
			case "zh-hk":
			case "zh-mo":
			case "zh-hant":
				return "Traditional Chinese (繁體中文)";
			case "zh-cn":
			case "zh-sg":
			case "zh-hans":
				return "Simplified Chinese (简体中文)";
			case "en-us":
				return "English";
			case "ja-jp":
				return "Japanese (日本語)";
			case "ko-kr":
				return "Korean (한국어)";
			case "de-de":
				return "German (Deutsch)";
			case "fr-fr":
				return "French (Français)";
			case "th-th":
				return "Thai (ไทย)";
			default:
				break;
		}

		switch (normalizedLocale.split("-", 2)[0]) {
			case "zh":
				return "Simplified Chinese (简体中文)";
			case "en":
				return "English";
			case "ja":
				return "Japanese (日本語)";
			case "ko":
				return "Korean (한국어)";
			case "de":
				return "German (Deutsch)";
			case "fr":
				return "French (Français)";
			case "th":
				return "Thai (ไทย)";
			default:
				return null;
		}
	}

	private String resolveModel(SystemInfo.AiSetting aiSetting, String requestedModel) {
		if (StringUtils.hasText(requestedModel)) {
			return requestedModel;
		}
		List<String> models = aiSetting.getModels() == null ? Collections.emptyList()
				: aiSetting.getModels().stream().filter(StringUtils::hasText).distinct().collect(Collectors.toList());
		return resolveDefaultModel(aiSetting, models);
	}

	private String resolveDefaultModel(SystemInfo.AiSetting aiSetting, List<String> models) {
		if (StringUtils.hasText(aiSetting.getDefaultModel()) && models.contains(aiSetting.getDefaultModel())) {
			return aiSetting.getDefaultModel();
		}
		return models.isEmpty() ? null : models.get(0);
	}

	private String getApiKey(SystemInfo.AiSetting aiSetting) {
		return StringUtils.hasText(aiSetting.getApiKey()) ? aiSetting.getApiKey() : aiSetting.getToken();
	}

	private String getChatCompletionsUrl(SystemInfo.AiSetting aiSetting) {
		String baseUrl = aiSetting.getBaseUrl();
		if (!StringUtils.hasText(baseUrl)) {
			baseUrl = !StringUtils.hasText(aiSetting.getApiKey()) && StringUtils.hasText(aiSetting.getToken())
					? LEGACY_SILICONFLOW_BASE_URL : DEFAULT_BASE_URL;
		}
		baseUrl = baseUrl.trim();
		if (!baseUrl.startsWith("https://") && !baseUrl.startsWith("http://")) {
			throw new IllegalArgumentException("模型服务地址必须以 http:// 或 https:// 开头");
		}
		baseUrl = baseUrl.replaceAll("/+$", "");
		return baseUrl.endsWith("/chat/completions") ? baseUrl : baseUrl + "/chat/completions";
	}

}
