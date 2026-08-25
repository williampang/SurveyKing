package cn.surveyking.server.mapper;

import cn.surveyking.server.domain.model.File;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Select;
import org.springframework.cache.annotation.Cacheable;

import java.io.Serializable;

/**
 * @author javahuang
 * @date 2021/9/8
 */
public interface FileMapper extends BaseMapper<File> {

	@Cacheable(cacheNames = "fileCache", key = "#id", unless = "#result == null")
	File selectById(Serializable id);

	@Select("select coalesce(sum(file_size), 0) from t_file where project_id = #{projectId} and is_deleted = 0")
	Long selectTotalSizeByProjectId(String projectId);

	@Select("select coalesce(sum(file_size), 0) from t_file where project_id is not null and is_deleted = 0")
	Long selectTotalPublicSize();

}
