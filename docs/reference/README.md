# Reference documents

这个目录保存接口参考资料，不能直接等同于当前实现。

- `小云雀-营销成片Agent-接口文档.md`：历史参考。它描述的是营销成片 Agent / 视觉异步任务，不是 YQhub 当前的 Seedance 2.0 Fast 生成链路。

YQhub 当前按小云雀官网“连接 Agent”的 Skill API 实现：

- `POST /api/biz/v1/skill/upload_file`
- `POST /api/biz/v1/skill/submit_run`
- `POST /api/biz/v1/skill/get_thread`
- `Authorization: Bearer <ak-...>`
- `agent_name: "pippit_video_part_agent"`
- 默认 `video_part_tool_param.model: "Seedance_2.0_mini"`；`seedance2.0_fast_direct` 仅作为工作台备选项。
