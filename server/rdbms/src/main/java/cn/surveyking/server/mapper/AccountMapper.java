package cn.surveyking.server.mapper;

import cn.surveyking.server.domain.model.Account;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;

/**
 * @author javahuang
 * @date 2021/10/12
 */
public interface AccountMapper extends BaseMapper<Account> {

	@Delete("DELETE FROM t_account WHERE id = #{id} AND user_id = #{userId} AND auth_type <> 'PWD'")
	int physicallyDeleteExternal(@Param("id") String id, @Param("userId") String userId);

	@Delete("DELETE FROM t_account WHERE user_id = #{userId} AND auth_type <> 'PWD'")
	int physicallyDeleteExternalByUserId(@Param("userId") String userId);

}
