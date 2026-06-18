<span id="BqHCg0FS"></span>
# 接入说明

<span id="IRYtnPuo"></span>
## 请求说明


|名称 |内容 |
|---|---|
|接口地址 |[https://visual.volcengineapi.com](https://visual.volcengineapi.com/) |
|请求方式 |POST |
|Content\-Type |application/json |


<span id="4gBH0RpB"></span>
## 提交任务

<span id="N9dklpZ4"></span>
### **提交任务请求参数**

<span id="YROfUcrV"></span>
#### **Query参数**

<div data-tips="true" data-tips-type="default">拼接到url后的参数，示例：<a href="https://visual.volcengineapi.com?Action=CVSync2AsyncSubmitTask&Version=2022-08-31">https://visual.volcengineapi.com?Action=CVSync2AsyncSubmitTask&Version=2022\-08\-31</a></div>



|参数 |类型 |**可选/必选** |说明 |
|---|---|---|---|
|Action |string |必选 |接口名，取值：**CVSync2AsyncSubmitTask** |
|Version |string |必选 |版本号，取值：2022\-08\-31 |


<span id="I4OKFHCn"></span>
#### **Header参数**

<div data-tips="true" data-tips-type="warning" data-tips-is-title="true">注意</div>


<div data-tips="true" data-tips-type="warning">本服务固定值：<strong>Region为cn\-north\-1，Service为cv</strong></div>


主要用于鉴权，详见 [公共参数](https://www.volcengine.com/docs/6369/67268) \- 签名参数 \- 在Header中的场景部分

<span id="FNfdkn3N"></span>
#### **Body参数**

<div data-tips="true" data-tips-type="warning" data-tips-is-title="true">注意</div>


<div data-tips="true" data-tips-type="warning">业务请求参数，放到request.body中，MIME\-Type为<strong>application/json</strong></div>



|参数 |类型 |**可选/必选** |说明 |
|---|---|---|---|
|req_key |string |必选 |服务标识<br><br>取固定值: **pippit_shortplay_cvtob_video_generate_fast720p** |
|assets_id |string |必选 |资产 ID，剧本解析接口返回的assets_id |
|thread_id |string |必选 |会话 ID，剧本解析接口返回的thread_id |
|episode_id |string |必选 |剧集 ID，剧本解析接口返回的EpisodeID |
|run_id |string |可选 |用户自定义 ID，用于幂等校验<br><br><br>* 当提交不同的 run_id 或不传入 run_id 时，会当做新任务处理并计费<br><br>* 当重复提交相同 run_id 后，在查询任务时会响应错误码 50500<br><br>* run_id 长度需小于32位 |


<span id="oYnberU0"></span>
### 提交任务返回参数

<span id="ML0ams8Z"></span>
#### **通用返回参数**

请参考[通用返回字段及错误码](https://www.volcengine.com/docs/6444/69728)

<span id="4RAPG2KN"></span>
#### **业务返回参数**

<div data-tips="true" data-tips-type="default" data-tips-is-title="true">重点关注data中以下字段，其他字段为公共返回(可忽略或不做解析)</div>



|字段 |类型 |说明 |
|---|---|---|
|task_id |string |任务ID，用于查询结果 |


<span id="BonsaGo6"></span>
### 提交任务请求&返回完整示例

**请求示例：** 

```JSON
{
    "req_key": "pippit_shortplay_cvtob_video_generate_fast720p",
    "assets_id": "ark_1078230262796",
    "thread_id": "ark_4897354138488855440",
    "episode_id": "1",
    "run_id": "run_id_xxxx"
}
```


**返回示例：** 

```JSON
{
    "code": 10000, //状态码，判断状态，code!=10000的情况下，不会返回task_id
    "data": {
        "task_id": "7392616336519610409" //任务ID，查询接口使用
    },
    "message": "Success",
    "request_id": "20240720103939AF0029465CF6A74E51EC", //排查错误的关键信息
    "time_elapsed": "104.852309ms" //链路耗时
}
```


<span id="uobaWjuO"></span>
## 查询任务

<span id="lBHbmicG"></span>
### **查询任务请求参数**

<span id="E6qbkXur"></span>
#### **Query参数**

<div data-tips="true" data-tips-type="default" data-tips-is-title="true">拼接到url后的参数，示例：<a href="https://visual.volcengineapi.com/">https://visual.volcengineapi.com</a><a href="https://visual.volcengineapi.com?Action=CVGetResult&Version=2022-08-31">?Action=CVSync2AsyncGetResult&Version=2022\-08\-31</a></div>



|参数 |类型 |**可选/必选** |说明 |
|---|---|---|---|
|Action |string |必选 |接口名，固定值：**CVSync2AsyncGetResult** |
|Version |string |必选 |版本号，固定值：**2022\-08\-31** |


<span id="HEvrXc94"></span>
#### **Header参数**

<div data-tips="true" data-tips-type="warning" data-tips-is-title="true">注意</div>


<div data-tips="true" data-tips-type="warning">本服务固定值：<strong>Region为cn\-north\-1，Service为cv</strong></div>


主要用于鉴权，详见 [公共参数](https://www.volcengine.com/docs/6369/67268) \- 签名参数 \- 在Header中的场景部分

<span id="ycY0c1mU"></span>
#### **Body参数**

<div data-tips="true" data-tips-type="warning" data-tips-is-title="true">注意</div>


<div data-tips="true" data-tips-type="warning">业务请求参数，放到request.body中，MIME\-Type为<strong>application/json</strong></div>



|参数 |类型 |**可选/必选** |说明 |
|---|---|---|---|
|req_key |string |必选 |服务标识<br><br>取固定值: **pippit_shortplay_cvtob_video_generate_fast720p** |
|task_id |string |必选 |任务ID，此字段的取值为**提交任务接口**的返回 |


<span id="AiebjT6V"></span>
### 查询任务返回参数

<span id="L6UtutmR"></span>
#### **通用返回参数**

请参考[通用返回字段及错误码](https://www.volcengine.com/docs/6444/69728)

<span id="nRE3Qhlu"></span>
#### **业务返回参数**

<div data-tips="true" data-tips-type="default" data-tips-is-title="true">说明</div>


<div data-tips="true" data-tips-type="default">重点关注data中以下字段，其他字段为公共返回(可忽略或不做解析)</div>



|参数名 |类型 | |
|---|---|---|
|status |string |任务执行状态<br><br><br>* processing：任务前置处理<br><br>* in_queue：任务已提交<br><br>* generating：任务已被消费，处理中<br><br>* done：处理完成，成功或者失败，可根据外层code&message进行判断<br><br>* not_found：任务未找到，可能原因是无此任务或任务已过期(12小时)<br><br>* expired：任务已过期，请尝试重新提交任务请求 |
|resp_data |JSON string |视频生成详细数据，格式为序列化后的JSON字符串，数据说明详见下表 **RespData参数说明**<br><br>真实场景参数示例详见[「小云雀-短剧漫剧Agent-全流程调用示例」](https://www.volcengine.com/docs/85621/2459788?lang=zh#FbWykccK) |


<span id="5bdv6jUw"></span>
#### RespData参数说明

<div data-tips="true" data-tips-type="default" data-tips-is-title="true">说明</div>



1. <div data-tips="true" data-tips-type="default">可通过遍历 ShotStatusMap（各分镜的状态映射）中的 Status（分镜状态），确认所有分镜是否都成功完成；<strong>若存在生成失败的分镜，将无法调用视频合成接口生成最终视频</strong>；</div>


2. <div data-tips="true" data-tips-type="default">当少数分镜生成失败时，可保存失败分镜的 Description（分镜描述）以及图片生成接口返回的图片资源，前往第三方工具重新生成失败的分镜视频；并下载其余生成成功的分镜视频，通过第三方工具进行视频拼接，合成最终视频。</div>




|**层级** |**参数名称** |**类型** |**说明** |
|---|---|---|---|
|1 |assets_id |string |资产 ID |
|1 |thread_id |string |会话 ID |
|1 |status |string |状态说明 |
|1 |storyboard_detail |array of object |单集资源详情 |
|2 |EpisodeID |string |剧集 ID |
|2 |EpisodeAssetID |string |剧集资产 ID |
|2 |VisualStyle |string |视觉风格描述 |
|2 |RoleList |array of object |分镜中的角色列表 |
|3 |RoleID |string |角色形象 ID |
|3 |RoleName |string |角色形象名称 |
|3 |VisualAttributes |string |角色视觉属性 |
|3 |VocalAttributes |string |角色声音属性 |
|3 |MaterialID |string |素材 ID |
|2 |LocationList |array of object |分镜中的场景/地点列表 |
|3 |LocationID |string |场景 ID |
|3 |LocationName |string |场景名称 |
|3 |Description |string |场景描述 |
|3 |MaterialID |string |素材 ID |
|2 |ScriptStatus |int |分镜脚本状态<br><br><br>* 0：未知状态<br><br>* 1：已初始化，资产已创建但尚未开始生成<br><br>* 2：生成中<br><br>* 3：已完成<br><br>* 4：生成失败<br><br>* 5：安全审核失败 |
|2 |ShotStatusMap |array of object |各分镜的状态映射 |
|3 |S1 |array of object |ShotID |
|4 |RunID |string |运行 ID |
|4 |Status |int |**分镜状态**<br><br><br>* 0：未知状态<br><br>* 1：已初始化，资产已创建但尚未开始生成<br><br>* 2：生成中<br><br>* 3：已完成<br><br>* 4：生成失败<br><br>* 5：安全审核失败 |
|2 |Shots |array of object |分镜 shot 列表 |
|3 |ShotID |string |分镜 ID |
|3 |Description |string |**分镜描述** |
|3 |Status |int |分镜状态<br><br><br>* 0：未知状态<br><br>* 1：已初始化，资产已创建但尚未开始生成<br><br>* 2：生成中<br><br>* 3：已完成<br><br>* 4：生成失败<br><br>* 5：安全审核失败 |
|3 |VideoURL |string |生成的视频 URL |
|3 |ContentLength |string |分镜脚本字数 |
|3 |Duration |int |视频时长（单位：毫秒） |
|3 |ModelName |string |生成模型名称 |
|3 |LocationIDList |array of string |关联场景 ID 列表 |
|3 |Version |int |版本号 |
|3 |Width |int |视频宽度 |
|3 |Height |int |视频高度 |
|3 |Format |string |视频格式 |
|3 |Size |int |视频大小（单位：字节） |
|3 |VideoAssetID |string |视频资产 ID |
|1 |charge_count |int |计费统计 |


<span id="ZXTyFgYh"></span>
### 

<span id="XnkhRwi2"></span>
### 查询任务请求&返回完整示例

> 真实场景参数示例详见[「小云雀-短剧漫剧Agent-全流程调用示例」](https://www.volcengine.com/docs/85621/2459788?lang=zh#FbWykccK)


**请求示例：** 

```JSON
{
    "req_key": "pippit_shortplay_cvtob_video_generate_fast720p",
    "task_id": "7491596536074305586"
}
```


**返回示例：** 

```JSON
{
    "code": 10000, //状态码，优先判断 code=10000, 然后再判断data.status，否则解析有可能会panic
    "data": {
        "status": "done", //任务状态
        "resp_data": "{}" // 视频生成详细数据，JSON字符串格式，可按需解析
    },
    "message": "Success",
    "status": 10000,  //无需关注，请忽略
    "request_id": "2025061718460554C9B78D23B0BAB45B2A",  //排查错误的关键信息
    "time_elapsed": "508.312154ms" //链路耗时
}
```


**返回报错示例：** 

```JSON
{
    "code": 50413, //状态码，优先判断 code=10000, 然后再判断data.status，否则解析有可能会panic
    "data": null, //code!=10000的情况下，该字段返回为null
    "message": "Post Text Risk Not Pass", //错误信息
    "request_id": "202511281418218670D408837A9B0EB58F", //排查错误的关键信息
    "status": 50413, //无需关注，请忽略
    "time_elapsed": "36.799829ms" //链路耗时
}
```


<span id="75JRvBLb"></span>
## 错误码

<span id="NtSYSqgy"></span>
### **通用错误码**

请参考[通用返回字段及错误码](https://www.volcengine.com/docs/6444/69728)

<span id="kjPiBdt3"></span>
### **业务错误码**


|HttpCode |错误码 |错误消息 |描述 |是否需要重试 |
|---|---|---|---|---|
|200 |10000 |无 |请求成功 |不需要 |
|400 |50411 |Pre Img Risk Not Pass |输入图片前审核未通过 |不需要 |
|400 |50511 |Post Img Risk Not Pass |输出图片后审核未通过 |可重试 |
|400 |50412 |Text Risk Not Pass |输入文本前审核未通过 |不需要 |
|400 |50512 |Post Text Risk Not Pass |输出文本后审核未通过 |不需要 |
|400 |50513 |Pre Video Risk Not Pass |输入视频前审核未通过 |不需要 |
|400 |50514 |Pre Audio Risk Not Pass |输入音频前审核未通过 |不需要 |
|400 |50413 |Post Text Risk Not Pass |输入文本含敏感词、版权词等审核不通过 |不需要 |
|429 |50429 |Request Has Reached API Limit, Please Try Later |QPS超限 |可重试 |
|429 |50430 |Request Has Reached API Concurrent Limit, Please Try Later |并发超限 |可重试 |
|500 |50500 |Internal Error |内部错误 |可重试 |
|500 |50501 |Internal RPC Error |内部算法错误 |可重试 |


<span id="f02zJ2AB"></span>
## 接入说明

<span id="vgIlcNoX"></span>
### SDK使用说明

请参考[SDK使用说明](https://www.volcengine.com/docs/6444/1340578)

<span id="KkxBGcaM"></span>
### HTTP方式接入说明

请参考[HTTP请求示例](https://www.volcengine.com/docs/6444/1390583)



