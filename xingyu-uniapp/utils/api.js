/**
 * API 接口定义
 * 路径对齐 xingyu-backend（/api/v1/*）
 */
import { get, post, put, del, upload } from './request.js'

const APP = '/api/v1/app'
const ADMIN = '/api/v1/admin'
const AUTH = '/api/v1/auth'

// ==================== 认证相关 ====================

/** 微信小程序登录 */
export const wxLogin = (data) => post(`${APP}/auth/login`, data)

/** 发送短信验证码 */
export const sendSmsCode = (data) => post(`${APP}/auth/sms-code`, data)

/** 获取当前用户信息 */
export const getUserInfo = () => get(`${AUTH}/info`)

/** 获取个人资料 */
export const getProfile = () => get(`${AUTH}/profile`)

/** 更新个人资料 */
export const updateProfile = (data) => put(`${AUTH}/profile`, data)

/** App端获取个人资料 */
export const getAppProfile = () => get(`${APP}/auth/profile`)

/** App端更新个人资料（头像、昵称、邮箱、手机、性别） */
export const updateAppProfile = (data) => put(`${APP}/auth/profile`, data)

/** App端上传头像（无需文件管理权限） */
export const uploadAvatar = (filePath) => upload(`${APP}/auth/upload-avatar`, filePath)

/** 修改密码 */
export const changePassword = (data) => post(`${AUTH}/password`, data)

/** App端修改密码 */
export const changeAppPassword = (data) => post(`${APP}/auth/password`, data)

/** 退出登录（Sa-Token / App 端） */
export const logout = () => post(`${APP}/auth/logout`)

// ==================== 私聊相关（兼容层，旧表已移除） ====================

/** 发送私聊消息 */
export const sendMessage = (data) => post(`${ADMIN}/sys/chat/send`, data)

/** 获取聊天记录 */
export const getChatHistory = (targetId, page = 1, pageSize = 20) =>
  get(`${ADMIN}/sys/chat/history/${targetId}`, { page, pageSize })

/** 获取最近联系人 */
export const getRecentContacts = () => get(`${ADMIN}/sys/chat/contacts`)

/** 获取用户列表（通讯录） */
export const getChatUsers = () => get(`${ADMIN}/sys/chat/users`)

/** 标记消息已读 */
export const markAsRead = (senderId) => post(`${ADMIN}/sys/chat/read/${senderId}`)

/** 获取未读消息数 */
export const getUnreadCount = () => get(`${ADMIN}/sys/chat/unread-count`)

/** 获取消息统计 */
export const getMessageStats = () => get(`${ADMIN}/sys/chat/unread-count`)

/** 检查用户是否在线 */
export const checkOnline = (userId) => get(`${ADMIN}/sys/chat/online/${userId}`)

/** 清空聊天记录 */
export const clearChatHistory = (targetId) => del(`${ADMIN}/sys/chat/clear/${targetId}`)

/** 拉黑用户 */
export const blockUser = (targetId) => post(`${ADMIN}/sys/chat/block/${targetId}`)

/** 取消拉黑 */
export const unblockUser = (targetId) => del(`${ADMIN}/sys/chat/block/${targetId}`)

/** 获取黑名单 */
export const getBlacklist = () => get(`${ADMIN}/sys/chat/blacklist`)

/** 检查是否拉黑 */
export const checkBlocked = (targetId) => get(`${ADMIN}/sys/chat/blocked/${targetId}`)

// ==================== 群聊相关（兼容层） ====================

/** 创建群聊 */
export const createGroup = (data) => post(`${ADMIN}/chat/group/create`, data)

/** 获取我的群列表 */
export const getGroupList = () => get(`${ADMIN}/chat/group/list`)

/** 获取群详情 */
export const getGroupDetail = (groupId) => get(`${ADMIN}/chat/group/${groupId}`)

/** 更新群信息 */
export const updateGroup = (data) => put(`${ADMIN}/chat/group/update`, data)

/** 解散群聊 */
export const dissolveGroup = (groupId) => del(`${ADMIN}/chat/group/${groupId}`)

/** 退出群聊 */
export const quitGroup = (groupId) => post(`${ADMIN}/chat/group/${groupId}/quit`)

/** 获取群成员列表 */
export const getGroupMembers = (groupId) => get(`${ADMIN}/chat/group/${groupId}/members`)

/** 添加群成员 */
export const addGroupMembers = (groupId, userIds) =>
  post(`${ADMIN}/chat/group/${groupId}/members`, { userIds })

/** 移除群成员 */
export const removeGroupMember = (groupId, memberId) =>
  del(`${ADMIN}/chat/group/${groupId}/members/${memberId}`)

/** 发送群消息 */
export const sendGroupMessage = (groupId, data) =>
  post(`${ADMIN}/chat/group/${groupId}/message`, data)

/** 获取群消息历史 */
export const getGroupMessages = (groupId, page = 1, pageSize = 50) =>
  get(`${ADMIN}/chat/group/${groupId}/messages`, { page, pageSize })

/** 转让群主 */
export const transferGroupOwner = (groupId, newOwnerId) =>
  post(`${ADMIN}/chat/group/${groupId}/transfer/${newOwnerId}`)

// ==================== 文件相关 ====================

/** 上传文件 */
export const uploadFile = (filePath) => upload(`${ADMIN}/sys/file/upload`, filePath)

// ==================== 系统通知 ====================

/** 获取通知列表 */
export const getNoticeList = (page = 1, pageSize = 10) =>
  get(`${ADMIN}/sys/notice/my`, { page, pageSize })

/** 标记通知已读 */
export const readNotice = (id) => post(`${ADMIN}/sys/notice/${id}/read`)
