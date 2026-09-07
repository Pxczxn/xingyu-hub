<template>
  <div class="chat-page page-container">
    <header class="admin-page-heading chat-page-heading">
      <div><p class="admin-page-heading__kicker">TEAM MESSAGING</p><h1>消息会话</h1><span class="admin-page-heading__description">处理后台成员之间的私聊与群组协作。</span></div>
      <n-tag size="small" type="info" :bordered="false">即时消息</n-tag>
    </header>
    <n-card 
      class="chat-card" 
      :class="{ 'chat-fullscreen': isFullscreen }"
    >
      <div class="chat-wrapper">
        <!-- 左侧联系人列表 -->
        <div class="chat-sidebar" :style="{ width: sidebarWidth + 'px' }">
          <div class="sidebar-header">
            <n-input v-model:value="searchKeyword" placeholder="搜索" clearable size="small">
              <template #prefix>
                <n-icon><SearchOutline /></n-icon>
              </template>
            </n-input>
          </div>
          <!-- 标签切换 -->
          <div class="sidebar-tabs">
            <div class="tab-item" :class="{ active: chatMode === 'private' }" @click="chatMode = 'private'">
              私聊
            </div>
            <div class="tab-item" :class="{ active: chatMode === 'group' }" @click="chatMode = 'group'">
              群聊
            </div>
            <n-button v-if="chatMode === 'group'" text size="small" type="primary" @click="showCreateGroup = true">
              <template #icon><n-icon><AddOutline /></n-icon></template>
            </n-button>
          </div>
          <!-- 私聊列表 -->
          <div v-if="chatMode === 'private'" class="contact-list">
            <div
              v-for="user in filteredUsers"
              :key="user.id"
              class="contact-item"
              :class="{ active: selectedUser?.id === user.id && !selectedGroup, blocked: user.isBlocked }"
              @click="selectUser(user)"
            >
              <div class="avatar-wrapper">
                <n-avatar round size="small" :src="user.avatar || undefined">
                  {{ user.nickname?.charAt(0) || 'U' }}
                </n-avatar>
                <span v-if="onlineStatus[user.id] && !user.isBlocked" class="online-indicator"></span>
                <n-icon v-if="user.isBlocked" class="blocked-icon" size="12" color="#d03050">
                  <BanOutline />
                </n-icon>
              </div>
              <div class="contact-info">
                <div class="contact-header">
                  <span class="contact-name" :class="{ 'blocked-text': user.isBlocked }">{{ user.nickname }}</span>
                  <span class="contact-time" v-if="user.lastMessageTime">{{ formatListTime(user.lastMessageTime) }}</span>
                </div>
                <div class="contact-last-msg" v-if="user.isBlocked">
                  <span class="blocked-msg">已拉黑</span>
                </div>
                <div class="contact-last-msg" v-else-if="user.lastMessage">
                  {{ user.lastMessage.length > 20 ? user.lastMessage.slice(0, 20) + '...' : user.lastMessage }}
                </div>
                <div class="contact-last-msg" v-else>
                  <span class="no-message">暂无消息</span>
                </div>
              </div>
            </div>
            <n-empty v-if="filteredUsers.length === 0" description="暂无联系人" size="small" />
          </div>
          <!-- 群聊列表 -->
          <div v-else class="contact-list">
            <div
              v-for="group in filteredGroups"
              :key="group.id"
              class="contact-item"
              :class="{ active: selectedGroup?.id === group.id }"
              @click="selectGroup(group)"
            >
              <n-avatar round size="small" :style="{ background: '#18a058' }">
                {{ group.name?.charAt(0) || 'G' }}
              </n-avatar>
              <div class="contact-info">
                <div class="contact-header">
                  <span class="contact-name">{{ group.name }}</span>
                  <span class="contact-time" v-if="group.lastMessageTime">{{ formatListTime(group.lastMessageTime) }}</span>
                  <span v-else class="member-count-badge">{{ group.memberCount }}人</span>
                </div>
                <div class="contact-last-msg" v-if="group.lastMessage">
                  {{ group.lastMessage.length > 20 ? group.lastMessage.slice(0, 20) + '...' : group.lastMessage }}
                </div>
                <div class="contact-last-msg" v-else>
                  <span class="no-message">暂无消息</span>
                </div>
              </div>
            </div>
            <n-empty v-if="filteredGroups.length === 0" description="暂无群聊" size="small" />
          </div>
        </div>
        
        <!-- 可拖拽分隔条 -->
        <div 
          class="resize-handle"
          @mousedown="startResize"
        ></div>

        <!-- 右侧聊天区域 -->
        <div class="chat-main">
          <!-- 私聊模式 -->
          <template v-if="selectedUser && !selectedGroup">
            <!-- 聊天头部 -->
            <div class="chat-header">
              <n-avatar round :src="selectedUser.avatar || undefined">
                {{ selectedUser.nickname?.charAt(0) || 'U' }}
              </n-avatar>
              <div class="chat-header-info">
                <div class="chat-header-name">{{ selectedUser.nickname }}</div>
                <div class="chat-header-status">
                  <span v-if="onlineStatus[selectedUser.id]" class="online">在线</span>
                  <span v-else class="offline">离线</span>
                </div>
              </div>
              <div class="chat-header-actions">
                <!-- 搜索消息 -->
                <n-popover trigger="click" placement="bottom" :show-arrow="false">
                  <template #trigger>
                    <n-button quaternary circle title="搜索消息">
                      <template #icon>
                        <n-icon size="18"><SearchOutline /></n-icon>
                      </template>
                    </n-button>
                  </template>
                  <div class="search-message-panel">
                    <n-input v-model:value="messageSearchKeyword" placeholder="搜索聊天记录" clearable size="small">
                      <template #prefix>
                        <n-icon><SearchOutline /></n-icon>
                      </template>
                    </n-input>
                    <div class="search-results" v-if="messageSearchKeyword">
                      <div 
                        v-for="msg in filteredMessages" 
                        :key="msg.id" 
                        class="search-result-item"
                        @click="scrollToMessage(msg.id!)"
                      >
                        <span class="result-content">{{ msg.content.slice(0, 30) }}{{ msg.content.length > 30 ? '...' : '' }}</span>
                        <span class="result-time">{{ formatTime(msg.sendTime) }}</span>
                      </div>
                      <n-empty v-if="filteredMessages.length === 0" description="无匹配消息" size="small" />
                    </div>
                  </div>
                </n-popover>
                <!-- 更多操作 -->
                <n-dropdown trigger="click" :options="privateChatOptions" @select="handlePrivateChatAction">
                  <n-button quaternary circle title="更多">
                    <template #icon>
                      <n-icon size="18"><EllipsisVerticalOutline /></n-icon>
                    </template>
                  </n-button>
                </n-dropdown>
                <n-button quaternary circle @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏聊天'">
                  <template #icon>
                    <n-icon size="18">
                      <ContractOutline v-if="isFullscreen" />
                      <ExpandOutline v-else />
                    </n-icon>
                  </template>
                </n-button>
              </div>
            </div>

        <!-- 消息列表 -->
        <div ref="messageListRef" class="message-list" @scroll="handleScroll">
          <div v-if="loadingHistory" class="loading-more">
            <n-spin size="small" />
          </div>
          <div
            v-for="msg in messages"
            :key="msg.id"
            :data-msg-id="msg.id"
            class="message-item"
            :class="{ 'message-self': msg.senderId === currentUserId }"
          >
            <n-avatar round size="small" :src="msg.senderAvatar || undefined">
              {{ msg.senderName?.charAt(0) || 'U' }}
            </n-avatar>
            <div class="message-content">
              <!-- 图片消息 -->
              <div v-if="msg.msgType === 2" class="message-image" @click="previewImage(msg.content)">
                <img :src="msg.content" alt="图片" />
              </div>
              <!-- 文本消息 -->
              <div v-else class="message-bubble">{{ msg.content }}</div>
              <div class="message-time">{{ formatTime(msg.sendTime) }}</div>
            </div>
          </div>
          <n-empty v-if="messages.length === 0 && !loadingHistory" description="暂无消息" />
        </div>

        <!-- 输入区域 -->
        <div class="chat-input">
          <div class="input-toolbar">
            <!-- 表情选择 -->
            <n-popover trigger="click" placement="top-start" :show-arrow="false">
              <template #trigger>
                <n-button quaternary circle>
                  <template #icon>
                    <n-icon size="20"><HappyOutline /></n-icon>
                  </template>
                </n-button>
              </template>
              <div class="emoji-panel">
                <div class="emoji-tabs">
                  <span
                    v-for="(group, idx) in emojiGroups"
                    :key="idx"
                    class="emoji-tab"
                    :class="{ active: activeEmojiTab === idx }"
                    @click="activeEmojiTab = idx"
                  >
                    {{ group.icon }}
                  </span>
                </div>
                <div class="emoji-list">
                  <span
                    v-for="emoji in emojiGroups[activeEmojiTab].emojis"
                    :key="emoji"
                    class="emoji-item"
                    @click="insertEmoji(emoji)"
                  >
                    {{ emoji }}
                  </span>
                </div>
              </div>
            </n-popover>
            <!-- 图片上传 -->
            <n-upload
              :custom-request="handleUploadImage"
              :show-file-list="false"
              accept="image/*"
            >
              <n-button quaternary circle>
                <template #icon>
                  <n-icon size="20"><ImageOutline /></n-icon>
                </template>
              </n-button>
            </n-upload>
            <!-- 快捷语 -->
            <n-popover trigger="click" placement="top-start" :show-arrow="false">
              <template #trigger>
                <n-button quaternary circle title="快捷语">
                  <template #icon>
                    <n-icon size="20"><FlashOutline /></n-icon>
                  </template>
                </n-button>
              </template>
              <div class="quick-reply-panel">
                <div class="quick-reply-header">
                  <span>常用快捷语</span>
                  <n-button text size="small" @click="showQuickReplyEdit = true">管理</n-button>
                </div>
                <div class="quick-reply-list">
                  <div
                    v-for="(item, idx) in quickReplies"
                    :key="idx"
                    class="quick-reply-item"
                    @click="insertQuickReply(item)"
                  >
                    {{ item }}
                  </div>
                </div>
              </div>
            </n-popover>
          </div>
          <div class="input-area">
            <n-input
              ref="inputRef"
              v-model:value="inputContent"
              type="textarea"
              placeholder="输入消息，按Enter发送"
              :rows="2"
              @keydown.enter.exact.prevent="handleSend"
            />
          </div>
          <n-button type="primary" @click="handleSend" :disabled="!inputContent.trim()">
            发送
          </n-button>
        </div>
          </template>
          
          <!-- 群聊模式 -->
          <template v-else-if="selectedGroup">
            <!-- 群聊头部 -->
            <div class="chat-header">
              <n-avatar round :style="{ background: '#18a058' }">
                {{ selectedGroup.name?.charAt(0) || 'G' }}
              </n-avatar>
              <div class="chat-header-info">
                <div class="chat-header-name">{{ selectedGroup.name }}</div>
                <div class="chat-header-status">
                  <span class="member-count">{{ selectedGroup.memberCount }}人</span>
                </div>
              </div>
              <div class="chat-header-actions">
                <n-button quaternary circle @click="showGroupDetail = true" title="群设置">
                  <template #icon>
                    <n-icon size="18"><SettingsOutline /></n-icon>
                  </template>
                </n-button>
                <n-button quaternary circle @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏聊天'">
                  <template #icon>
                    <n-icon size="18">
                      <ContractOutline v-if="isFullscreen" />
                      <ExpandOutline v-else />
                    </n-icon>
                  </template>
                </n-button>
              </div>
            </div>
            
            <!-- 群消息列表 -->
            <div ref="groupMessageListRef" class="message-list" @scroll="handleScroll">
              <div v-if="loadingHistory" class="loading-more">
                <n-spin size="small" />
              </div>
              <div
                v-for="msg in groupMessages"
                :key="msg.id"
                class="message-item"
                :class="{ 
                  'message-self': msg.senderId === currentUserId,
                  'message-system': msg.msgType === 4
                }"
              >
                <!-- 系统消息 -->
                <div v-if="msg.msgType === 4" class="system-message">
                  {{ msg.content }}
                </div>
                <!-- 普通消息 -->
                <template v-else>
                  <n-avatar round size="small" :src="msg.senderAvatar || undefined">
                    {{ msg.senderName?.charAt(0) || 'U' }}
                  </n-avatar>
                  <div class="message-content">
                    <div v-if="msg.senderId !== currentUserId" class="message-sender">{{ msg.senderName }}</div>
                    <!-- 图片消息 -->
                    <div v-if="msg.msgType === 2" class="message-image" @click="previewImage(msg.content)">
                      <img :src="msg.content" alt="图片" />
                    </div>
                    <!-- 文本消息 -->
                    <div v-else class="message-bubble">{{ msg.content }}</div>
                    <div class="message-time">{{ formatTime(msg.sendTime) }}</div>
                  </div>
                </template>
              </div>
              <n-empty v-if="groupMessages.length === 0 && !loadingHistory" description="暂无消息" />
            </div>
            
            <!-- 群聊输入区域 -->
            <div class="chat-input">
              <div class="input-toolbar">
                <!-- 表情选择 -->
                <n-popover trigger="click" placement="top-start" :show-arrow="false">
                  <template #trigger>
                    <n-button quaternary circle>
                      <template #icon>
                        <n-icon size="20"><HappyOutline /></n-icon>
                      </template>
                    </n-button>
                  </template>
                  <div class="emoji-panel">
                    <div class="emoji-tabs">
                      <span
                        v-for="(group, idx) in emojiGroups"
                        :key="idx"
                        class="emoji-tab"
                        :class="{ active: activeEmojiTab === idx }"
                        @click="activeEmojiTab = idx"
                      >
                        {{ group.icon }}
                      </span>
                    </div>
                    <div class="emoji-list">
                      <span
                        v-for="emoji in emojiGroups[activeEmojiTab].emojis"
                        :key="emoji"
                        class="emoji-item"
                        @click="insertGroupEmoji(emoji)"
                      >
                        {{ emoji }}
                      </span>
                    </div>
                  </div>
                </n-popover>
                <!-- 图片上传 -->
                <n-upload
                  :custom-request="handleUploadGroupImage"
                  :show-file-list="false"
                  accept="image/*"
                >
                  <n-button quaternary circle>
                    <template #icon>
                      <n-icon size="20"><ImageOutline /></n-icon>
                    </template>
                  </n-button>
                </n-upload>
              </div>
              <div class="input-area">
                <n-input
                  ref="groupInputRef"
                  v-model:value="groupInputContent"
                  type="textarea"
                  placeholder="输入消息，按Enter发送"
                  :rows="2"
                  @keydown.enter.exact.prevent="handleGroupSend"
                />
              </div>
              <n-button type="primary" @click="handleGroupSend" :disabled="!groupInputContent.trim()">
                发送
              </n-button>
            </div>
          </template>
          
          <div v-else class="chat-empty">
            <n-empty description="选择一个联系人或群聊开始聊天" />
          </div>
        </div>

      </div>
    </n-card>
    
    <!-- 图片预览 -->
    <n-modal v-model:show="previewVisible" preset="card" title="图片预览" style="width: auto; max-width: 90vw">
      <img :src="previewUrl" alt="预览" style="max-width: 100%; max-height: 80vh" />
    </n-modal>
    
    <!-- 快捷语管理弹窗 -->
    <n-modal v-model:show="showQuickReplyEdit" preset="card" title="管理快捷语" style="width: 500px">
      <div class="quick-reply-edit">
        <div class="edit-tip">每行一条快捷语，最多20条</div>
        <n-input
          v-model:value="quickReplyEditText"
          type="textarea"
          placeholder="请输入快捷语，每行一条"
          :rows="10"
        />
      </div>
      <template #footer>
        <n-space justify="end">
          <n-button @click="resetQuickReplies">恢复默认</n-button>
          <n-button @click="showQuickReplyEdit = false">取消</n-button>
          <n-button type="primary" @click="saveQuickReplies">保存</n-button>
        </n-space>
      </template>
    </n-modal>
    
    <!-- 创建群聊弹窗 -->
    <n-modal v-model:show="showCreateGroup" preset="card" title="创建群聊" style="width: 500px">
      <n-form label-placement="left" label-width="80">
        <n-form-item label="群名称">
          <n-input v-model:value="newGroupName" placeholder="请输入群名称" maxlength="20" />
        </n-form-item>
        <n-form-item label="选择成员">
          <n-transfer
            v-model:value="newGroupMembers"
            :options="userOptions"
            source-filterable
            style="height: 300px"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showCreateGroup = false">取消</n-button>
          <n-button type="primary" @click="handleCreateGroup" :disabled="!newGroupName.trim() || newGroupMembers.length === 0">创建</n-button>
        </n-space>
      </template>
    </n-modal>
    
    <!-- 群详情/设置弹窗 -->
    <n-modal v-model:show="showGroupDetail" preset="card" title="群聊设置" style="width: 600px">
      <div v-if="selectedGroup" class="group-detail">
        <n-tabs type="line">
          <n-tab-pane name="info" tab="群信息">
            <n-form label-placement="left" label-width="80">
              <n-form-item label="群名称">
                <n-input v-model:value="editGroupName" placeholder="群名称" :disabled="!canEditGroup" />
              </n-form-item>
              <n-form-item label="群公告">
                <n-input v-model:value="editGroupAnnouncement" type="textarea" :rows="3" placeholder="群公告" :disabled="!canEditGroup" />
              </n-form-item>
              <n-form-item v-if="canEditGroup">
                <n-button type="primary" @click="handleUpdateGroup">保存修改</n-button>
              </n-form-item>
            </n-form>
          </n-tab-pane>
          <n-tab-pane name="members" tab="群成员">
            <div class="member-actions" v-if="canEditGroup">
              <n-button size="small" type="primary" @click="showAddMember = true">添加成员</n-button>
            </div>
            <div class="member-list">
              <div v-for="member in groupMembers" :key="member.id" class="member-item">
                <n-avatar round size="small" :src="member.avatar || undefined">
                  {{ member.userNickname?.charAt(0) || 'U' }}
                </n-avatar>
                <div class="member-info">
                  <div class="member-name">
                    {{ member.nickname || member.userNickname }}
                    <n-tag v-if="member.role === 2" size="small" type="warning">群主</n-tag>
                    <n-tag v-else-if="member.role === 1" size="small" type="info">管理员</n-tag>
                  </div>
                </div>
                <div class="member-actions" v-if="canManageMember(member)">
                  <n-dropdown :options="getMemberOptions(member)" @select="(key: string) => handleMemberAction(key, member)">
                    <n-button text size="small">操作</n-button>
                  </n-dropdown>
                </div>
              </div>
            </div>
          </n-tab-pane>
        </n-tabs>
        <n-divider />
        <div class="group-actions">
          <n-button v-if="isGroupOwner" type="error" @click="handleDissolveGroup">解散群聊</n-button>
          <n-button v-else type="warning" @click="handleQuitGroup">退出群聊</n-button>
        </div>
      </div>
    </n-modal>
    
    <!-- 添加成员弹窗 -->
    <n-modal v-model:show="showAddMember" preset="card" title="添加成员" style="width: 400px">
      <n-transfer
        v-model:value="addMemberIds"
        :options="availableUsers"
        source-filterable
        style="height: 300px"
      />
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAddMember = false">取消</n-button>
          <n-button type="primary" @click="handleAddMembers">确定</n-button>
        </n-space>
      </template>
    </n-modal>
    
    <!-- 用户资料弹窗 -->
    <n-modal v-model:show="showUserProfile" preset="card" title="用户资料" style="width: 400px">
      <div v-if="selectedUser" class="user-profile">
        <div class="profile-header">
          <n-avatar round size="large" :src="selectedUser.avatar || undefined">
            {{ selectedUser.nickname?.charAt(0) || 'U' }}
          </n-avatar>
          <div class="profile-info">
            <div class="profile-name">{{ selectedUser.nickname }}</div>
            <div class="profile-username">@{{ selectedUser.username }}</div>
            <n-tag v-if="onlineStatus[selectedUser.id]" type="success" size="small">在线</n-tag>
            <n-tag v-else type="default" size="small">离线</n-tag>
          </div>
        </div>
        <n-divider />
        <n-descriptions :column="1" label-placement="left">
          <n-descriptions-item label="用户ID">{{ selectedUser.id }}</n-descriptions-item>
          <n-descriptions-item label="用户名">{{ selectedUser.username }}</n-descriptions-item>
          <n-descriptions-item label="昵称">{{ selectedUser.nickname }}</n-descriptions-item>
        </n-descriptions>
      </div>
    </n-modal>
    
    <!-- 清空聊天确认弹窗 -->
    <n-modal v-model:show="showClearConfirm" preset="dialog" title="清空聊天记录" positive-text="确定" negative-text="取消" @positive-click="handleClearMessages">
      <template #icon>
        <n-icon color="#f0a020"><AlertCircleOutline /></n-icon>
      </template>
      确定要清空与 {{ selectedUser?.nickname }} 的所有聊天记录吗？此操作不可恢复。
    </n-modal>
    
    <!-- 拉黑用户确认弹窗 -->
    <n-modal v-model:show="showBlockConfirm" preset="dialog" title="拉黑用户" positive-text="确定" negative-text="取消" @positive-click="handleBlockUser">
      <template #icon>
        <n-icon color="#d03050"><BanOutline /></n-icon>
      </template>
      确定要将 {{ selectedUser?.nickname }} 加入黑名单吗？拉黑后双方将无法发送消息。
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, h } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage, NIcon, type UploadCustomRequestOptions } from 'naive-ui'
import { SearchOutline, ImageOutline, HappyOutline, ExpandOutline, ContractOutline, FlashOutline, AddOutline, SettingsOutline, EllipsisVerticalOutline, AlertCircleOutline, PersonOutline, TrashOutline, BanOutline } from '@vicons/ionicons5'
import { chatApi, groupChatApi, type ChatMessage, type ChatUser, type ChatGroup, type ChatGroupMember, type ChatGroupMessage } from '@/api/message'
import { fileApi } from '@/api/system'
import { useUserStore } from '@/stores/user'
import { wsManager } from '@/utils/websocket'

const route = useRoute()
const message = useMessage()
const userStore = useUserStore()
const currentUserId = computed(() => userStore.user?.id)

// 聊天模式
const chatMode = ref<'private' | 'group'>('private')

// 联系人
const users = ref<ChatUser[]>([])
const searchKeyword = ref('')
const selectedUser = ref<ChatUser | null>(null)
const onlineStatus = ref<Record<number, boolean>>({})

// 私聊消息
const messages = ref<ChatMessage[]>([])
const inputContent = ref('')
const loadingHistory = ref(false)
const messageListRef = ref<HTMLElement | null>(null)

// 群聊相关
const groups = ref<ChatGroup[]>([])
const selectedGroup = ref<ChatGroup | null>(null)
const groupMessages = ref<ChatGroupMessage[]>([])
const groupInputContent = ref('')
const groupInputRef = ref<any>(null)
const groupMessageListRef = ref<HTMLElement | null>(null)
const groupMembers = ref<ChatGroupMember[]>([])

// 创建群聊
const showCreateGroup = ref(false)
const newGroupName = ref('')
const newGroupMembers = ref<number[]>([])

// 群详情
const showGroupDetail = ref(false)
const editGroupName = ref('')
const editGroupAnnouncement = ref('')

// 添加成员
const showAddMember = ref(false)
const addMemberIds = ref<number[]>([])

// 图片预览
const previewVisible = ref(false)
const previewUrl = ref('')

// 全屏
const isFullscreen = ref(false)

// 私聊功能
const showUserProfile = ref(false)
const showClearConfirm = ref(false)
const showBlockConfirm = ref(false)
const messageSearchKeyword = ref('')

// 侧边栏拖拽调整
const sidebarWidth = ref(parseInt(localStorage.getItem('chat-sidebar-width') || '260'))
const isResizing = ref(false)

// 表情相关
const inputRef = ref<any>(null)
const activeEmojiTab = ref(0)

// 快捷语
const showQuickReplyEdit = ref(false)
const quickReplyEditText = ref('')
const defaultQuickReplies = [
  '你好，有什么可以帮助你的吗？',
  '好的，我知道了',
  '稍等，我确认一下',
  '收到，马上处理',
  '感谢你的反馈',
  '这个问题我需要核实一下，稍后回复你',
  '没问题，可以的',
  '抱歉，让你久等了',
  '请问还有其他问题吗？',
  '祝你工作顺利！'
]
const quickReplies = ref<string[]>(
  JSON.parse(localStorage.getItem('chat-quick-replies') || 'null') || defaultQuickReplies
)
const emojiGroups = [
  {
    icon: '😀',
    emojis: ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '🥱', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲']
  },
  {
    icon: '😢',
    emojis: ['😤', '😠', '😡', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎']
  },
  {
    icon: '👋',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️']
  },
  {
    icon: '🐶',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞']
  },
  {
    icon: '🍎',
    emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔']
  },
  {
    icon: '⚽',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣']
  },
  {
    icon: '🚗',
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛺', '🚁', '✈️', '🛩️', '🚀', '🛸', '🚢', '⛵', '🛥️', '🚤', '⛴️', '🛳️', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🛰️', '🪐', '⭐', '🌟', '💫', '✨', '☀️', '🌈']
  }
]

// 过滤联系人
const filteredUsers = computed(() => {
  if (!searchKeyword.value) return users.value
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return users.value
  return users.value.filter(u =>
    u.nickname?.toLowerCase().includes(keyword) ||
    u.username?.toLowerCase().includes(keyword)
  )
})

// 过滤消息（搜索功能）
const filteredMessages = computed(() => {
  if (!messageSearchKeyword.value) return []
  const keyword = messageSearchKeyword.value.toLowerCase()
  return messages.value.filter(m => 
    m.msgType === 1 && m.content.toLowerCase().includes(keyword)
  )
})

// 私聊操作菜单
const privateChatOptions = computed(() => {
  const options = [
    { label: '用户资料', key: 'profile', icon: () => h(NIcon, null, { default: () => h(PersonOutline) }) },
    { label: '清空记录', key: 'clear', icon: () => h(NIcon, null, { default: () => h(TrashOutline) }) },
    { type: 'divider', key: 'd1' }
  ]
  
  if (selectedUser.value?.isBlocked) {
    options.push({ 
      label: '取消拉黑', 
      key: 'unblock', 
      icon: () => h(NIcon, null, { default: () => h(PersonOutline) }) 
    })
  } else {
    options.push({ 
      label: '拉黑用户', 
      key: 'block', 
      icon: () => h(NIcon, null, { default: () => h(BanOutline) }) 
    })
  }
  
  return options
})

// 过滤群聊
const filteredGroups = computed(() => {
  if (!searchKeyword.value) return groups.value
  return groups.value.filter(g => g.name?.includes(searchKeyword.value))
})

// 用户选项（用于创建群聊）
const userOptions = computed(() => {
  return users.value
    .filter(u => u.id !== currentUserId.value)
    .map(u => ({ label: u.nickname, value: u.id }))
})

// 可添加的用户（排除已在群内的）
const availableUsers = computed(() => {
  const memberIds = groupMembers.value.map(m => m.userId)
  return users.value
    .filter(u => !memberIds.includes(u.id))
    .map(u => ({ label: u.nickname, value: u.id }))
})

// 是否可以编辑群
const canEditGroup = computed(() => {
  if (!selectedGroup.value) return false
  const member = groupMembers.value.find(m => m.userId === currentUserId.value)
  return member && member.role >= 1
})

// 是否是群主
const isGroupOwner = computed(() => {
  return selectedGroup.value?.ownerId === currentUserId.value
})

// 加载用户列表
async function loadUsers() {
  try {
    users.value = await chatApi.getUsers()
    // 检查在线状态
    users.value.forEach(async user => {
      onlineStatus.value[user.id] = await chatApi.isOnline(user.id)
    })
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 选择用户
async function selectUser(user: ChatUser) {
  selectedGroup.value = null
  selectedUser.value = user
  messages.value = []
  await loadMessages()
  // 标记已读
  await chatApi.markAsRead(user.id)
}

// 加载消息
async function loadMessages() {
  if (!selectedUser.value) return
  loadingHistory.value = true
  try {
    const res = await chatApi.getHistory(selectedUser.value.id, { page: 1, pageSize: 50 })
    messages.value = res.list.reverse()
    await nextTick()
    scrollToBottom()
  } catch (error) {
    // 错误已在拦截器处理
  } finally {
    loadingHistory.value = false
  }
}

// 更新联系人的最新消息
function updateUserLastMessage(userId: number, content: string, msgType: number = 1) {
  const user = users.value.find(u => u.id === userId)
  if (user) {
    user.lastMessage = msgType === 2 ? '[图片]' : content
  }
}

// 更新群聊的最新消息
function updateGroupLastMessage(groupId: number, senderName: string, content: string, msgType: number = 1) {
  const group = groups.value.find(g => g.id === groupId)
  if (group) {
    const displayContent = msgType === 2 ? '[图片]' : (msgType === 4 ? '[系统消息] ' + content : content)
    group.lastMessage = senderName + ': ' + displayContent
  }
}

// 发送文本消息
async function handleSend() {
  if (!inputContent.value.trim() || !selectedUser.value) return

  try {
    const msg = await chatApi.send({
      receiverId: selectedUser.value.id,
      content: inputContent.value.trim(),
      msgType: 1
    })
    messages.value.push(msg)
    // 更新联系人最新消息
    updateUserLastMessage(selectedUser.value.id, msg.content, 1)
    inputContent.value = ''
    await nextTick()
    scrollToBottom()
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 上传并发送图片
async function handleUploadImage(options: UploadCustomRequestOptions) {
  if (!selectedUser.value) {
    message.warning('请先选择联系人')
    options.onError()
    return
  }

  try {
    // 上传图片
    const result = await fileApi.uploadImage(options.file.file as File)

    // 发送图片消息
    const msg = await chatApi.send({
      receiverId: selectedUser.value.id,
      content: result.url,
      msgType: 2 // 图片类型
    })
    messages.value.push(msg)
    // 更新联系人最新消息
    updateUserLastMessage(selectedUser.value.id, '[图片]', 2)
    await nextTick()
    scrollToBottom()

    options.onFinish()
    message.success('图片发送成功')
  } catch (error) {
    options.onError()
  }
}

// 预览图片
function previewImage(url: string) {
  previewUrl.value = url
  previewVisible.value = true
}

// 插入表情（私聊）
function insertEmoji(emoji: string) {
  inputContent.value += emoji
  // 聚焦输入框
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 插入表情（群聊）
function insertGroupEmoji(emoji: string) {
  groupInputContent.value += emoji
  // 聚焦输入框
  nextTick(() => {
    groupInputRef.value?.focus()
  })
}

// 插入快捷语
function insertQuickReply(text: string) {
  inputContent.value = text
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// 监听快捷语编辑弹窗
watch(showQuickReplyEdit, (val) => {
  if (val) {
    quickReplyEditText.value = quickReplies.value.join('\n')
  }
})

// 保存快捷语
function saveQuickReplies() {
  const lines = quickReplyEditText.value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .slice(0, 20)
  quickReplies.value = lines
  localStorage.setItem('chat-quick-replies', JSON.stringify(lines))
  showQuickReplyEdit.value = false
  message.success('快捷语保存成功')
}

// 恢复默认快捷语
function resetQuickReplies() {
  quickReplyEditText.value = defaultQuickReplies.join('\n')
}

// ==================== 群聊相关方法 ====================

// 加载群列表
async function loadGroups() {
  try {
    groups.value = await groupChatApi.list()
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 选择群
async function selectGroup(group: ChatGroup) {
  selectedUser.value = null
  selectedGroup.value = group
  groupMessages.value = []
  await loadGroupMessages()
  await loadGroupMembers()
}

// 加载群消息
async function loadGroupMessages() {
  if (!selectedGroup.value) return
  loadingHistory.value = true
  try {
    const res = await groupChatApi.getMessages(selectedGroup.value.id!, 1, 50)
    groupMessages.value = res.list.reverse()
    await nextTick()
    scrollGroupToBottom()
  } catch (error) {
    // 错误已在拦截器处理
  } finally {
    loadingHistory.value = false
  }
}

// 加载群成员
async function loadGroupMembers() {
  if (!selectedGroup.value) return
  try {
    groupMembers.value = await groupChatApi.members(selectedGroup.value.id!)
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 发送群消息
async function handleGroupSend() {
  if (!groupInputContent.value.trim() || !selectedGroup.value) return
  
  try {
    const msg = await groupChatApi.sendMessage(
      selectedGroup.value.id!,
      groupInputContent.value.trim(),
      1
    )
    groupMessages.value.push(msg)
    // 更新群聊最新消息
    updateGroupLastMessage(selectedGroup.value.id!, msg.senderName || '我', msg.content, 1)
    groupInputContent.value = ''
    await nextTick()
    scrollGroupToBottom()
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 上传群图片
async function handleUploadGroupImage(options: UploadCustomRequestOptions) {
  if (!selectedGroup.value) {
    message.warning('请先选择群聊')
    options.onError()
    return
  }
  
  try {
    const result = await fileApi.uploadImage(options.file.file as File)
    const msg = await groupChatApi.sendMessage(
      selectedGroup.value.id!,
      result.url,
      2
    )
    groupMessages.value.push(msg)
    // 更新群聊最新消息
    updateGroupLastMessage(selectedGroup.value.id!, msg.senderName || '我', '[图片]', 2)
    await nextTick()
    scrollGroupToBottom()
    options.onFinish()
  } catch (error) {
    options.onError()
  }
}

// 滚动群消息到底部
function scrollGroupToBottom() {
  if (groupMessageListRef.value) {
    groupMessageListRef.value.scrollTop = groupMessageListRef.value.scrollHeight
  }
}

// 创建群聊
async function handleCreateGroup() {
  if (!newGroupName.value.trim()) {
    message.warning('请输入群名称')
    return
  }
  if (newGroupMembers.value.length === 0) {
    message.warning('请至少选择一个成员')
    return
  }
  try {
    const group = await groupChatApi.create({
      name: newGroupName.value.trim(),
      memberIds: newGroupMembers.value
    })
    message.success('群聊创建成功')
    showCreateGroup.value = false
    newGroupName.value = ''
    newGroupMembers.value = []
    chatMode.value = 'group'
    await loadGroups()
    selectGroup(group)
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 监听群详情弹窗
watch(showGroupDetail, (val) => {
  if (val && selectedGroup.value) {
    editGroupName.value = selectedGroup.value.name
    editGroupAnnouncement.value = selectedGroup.value.announcement || ''
  }
})

// 更新群信息
async function handleUpdateGroup() {
  if (!selectedGroup.value) return
  try {
    await groupChatApi.update({
      id: selectedGroup.value.id,
      name: editGroupName.value,
      announcement: editGroupAnnouncement.value
    } as ChatGroup)
    message.success('群信息更新成功')
    selectedGroup.value.name = editGroupName.value
    selectedGroup.value.announcement = editGroupAnnouncement.value
    await loadGroups()
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 添加成员
async function handleAddMembers() {
  if (!selectedGroup.value || addMemberIds.value.length === 0) return
  try {
    await groupChatApi.addMembers(selectedGroup.value.id!, addMemberIds.value)
    message.success('成员添加成功')
    showAddMember.value = false
    addMemberIds.value = []
    await loadGroupMembers()
    await loadGroups()
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 是否可以管理成员
function canManageMember(member: ChatGroupMember): boolean {
  const currentMember = groupMembers.value.find(m => m.userId === currentUserId.value)
  if (!currentMember) return false
  if (member.userId === currentUserId.value) return false
  return currentMember.role > member.role
}

// 获取成员操作选项
function getMemberOptions(member: ChatGroupMember) {
  const options: any[] = []
  const currentMember = groupMembers.value.find(m => m.userId === currentUserId.value)
  if (!currentMember) return options
  
  if (currentMember.role === 2) {
    // 群主操作
    if (member.role === 1) {
      options.push({ label: '取消管理员', key: 'removeAdmin' })
    } else if (member.role === 0) {
      options.push({ label: '设为管理员', key: 'setAdmin' })
    }
    options.push({ label: '转让群主', key: 'transfer' })
  }
  
  if (currentMember.role >= 1 && member.role < currentMember.role) {
    if (member.muted) {
      options.push({ label: '取消禁言', key: 'unmute' })
    } else {
      options.push({ label: '禁言', key: 'mute' })
    }
    options.push({ label: '移出群聊', key: 'remove' })
  }
  
  return options
}

// 处理成员操作
async function handleMemberAction(key: string, member: ChatGroupMember) {
  if (!selectedGroup.value) return
  
  try {
    switch (key) {
      case 'setAdmin':
        await groupChatApi.setAdmin(selectedGroup.value.id!, member.userId, true)
        message.success('已设为管理员')
        break
      case 'removeAdmin':
        await groupChatApi.setAdmin(selectedGroup.value.id!, member.userId, false)
        message.success('已取消管理员')
        break
      case 'mute':
        await groupChatApi.setMuted(selectedGroup.value.id!, member.userId, true)
        message.success('已禁言')
        break
      case 'unmute':
        await groupChatApi.setMuted(selectedGroup.value.id!, member.userId, false)
        message.success('已取消禁言')
        break
      case 'remove':
        await groupChatApi.removeMember(selectedGroup.value.id!, member.userId)
        message.success('已移出群聊')
        break
      case 'transfer':
        await groupChatApi.transferOwner(selectedGroup.value.id!, member.userId)
        message.success('已转让群主')
        break
    }
    await loadGroupMembers()
    await loadGroups()
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 解散群聊
async function handleDissolveGroup() {
  if (!selectedGroup.value) return
  if (!confirm('确定要解散该群聊吗？此操作不可恢复。')) return
  
  try {
    await groupChatApi.dissolve(selectedGroup.value.id!)
    message.success('群聊已解散')
    showGroupDetail.value = false
    selectedGroup.value = null
    groupMessages.value = []
    await loadGroups()
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 退出群聊
async function handleQuitGroup() {
  if (!selectedGroup.value) return
  if (!confirm('确定要退出该群聊吗？')) return
  
  try {
    await groupChatApi.quit(selectedGroup.value.id!)
    message.success('已退出群聊')
    showGroupDetail.value = false
    selectedGroup.value = null
    groupMessages.value = []
    await loadGroups()
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 切换全屏
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

// 开始拖拽调整侧边栏宽度
function startResize(e: MouseEvent) {
  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  
  const onMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return
    const diff = e.clientX - startX
    const newWidth = Math.min(Math.max(startWidth + diff, 200), 400)
    sidebarWidth.value = newWidth
  }
  
  const onMouseUp = () => {
    isResizing.value = false
    localStorage.setItem('chat-sidebar-width', sidebarWidth.value.toString())
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

// 滚动到底部
function scrollToBottom() {
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

// 滚动到指定消息
function scrollToMessage(msgId: number) {
  const msgElement = document.querySelector(`[data-msg-id="${msgId}"]`)
  if (msgElement) {
    msgElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // 高亮效果
    msgElement.classList.add('message-highlight')
    setTimeout(() => msgElement.classList.remove('message-highlight'), 2000)
  }
  messageSearchKeyword.value = ''
}

// 处理私聊操作
function handlePrivateChatAction(key: string) {
  switch (key) {
    case 'profile':
      showUserProfile.value = true
      break
    case 'clear':
      showClearConfirm.value = true
      break
    case 'block':
      showBlockConfirm.value = true
      break
    case 'unblock':
      handleUnblockUser()
      break
  }
}

// 拉黑用户
async function handleBlockUser() {
  if (!selectedUser.value) return
  try {
    await chatApi.blockUser(selectedUser.value.id)
    selectedUser.value.isBlocked = true
    // 更新用户列表中的状态
    const user = users.value.find(u => u.id === selectedUser.value?.id)
    if (user) {
      user.isBlocked = true
    }
    message.success('已将该用户加入黑名单')
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 取消拉黑
async function handleUnblockUser() {
  if (!selectedUser.value) return
  try {
    await chatApi.unblockUser(selectedUser.value.id)
    selectedUser.value.isBlocked = false
    // 更新用户列表中的状态
    const user = users.value.find(u => u.id === selectedUser.value?.id)
    if (user) {
      user.isBlocked = false
    }
    message.success('已将该用户移出黑名单')
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 清空聊天记录
async function handleClearMessages() {
  if (!selectedUser.value) return
  try {
    await chatApi.clearHistory(selectedUser.value.id)
    messages.value = []
    // 更新联系人最新消息
    updateUserLastMessage(selectedUser.value.id, '', 1)
    const user = users.value.find(u => u.id === selectedUser.value?.id)
    if (user) {
      user.lastMessage = undefined
    }
    message.success('聊天记录已清空')
  } catch (error) {
    // 错误已在拦截器处理
  }
}

// 处理滚动（加载更多）
function handleScroll() {
  // 可以在这里实现加载更多历史消息
}

// 格式化时间
function formatTime(time?: string): string {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// 格式化列表时间（类似微信）
function formatListTime(time?: string): string {
  if (!time) return ''
  const date = new Date(time)
  if (isNaN(date.getTime())) return ''
  
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000)
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  // 今天：显示 HH:mm
  if (targetDay.getTime() === today.getTime()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  
  // 昨天
  if (targetDay.getTime() === yesterday.getTime()) {
    return '昨天'
  }
  
  // 本周内：显示星期几
  if (targetDay.getTime() >= weekStart.getTime()) {
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekDays[date.getDay()]
  }
  
  // 今年内：显示 MM/DD
  if (date.getFullYear() === now.getFullYear()) {
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
  }
  
  // 更早：显示 YYYY/MM/DD
  return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`
}

// 监听WebSocket消息
function setupWebSocket() {
  // 私聊消息
  wsManager.on('chat', (data) => {
    // 更新联系人列表的最新消息
    updateUserLastMessage(data.senderId, data.content, data.msgType || 1)
    
    // 如果是当前聊天对象的消息
    if (selectedUser.value && data.senderId === selectedUser.value.id) {
      messages.value.push({
        id: Date.now(),
        senderId: data.senderId,
        senderName: data.senderName,
        receiverId: currentUserId.value!,
        content: data.content,
        msgType: data.msgType || 1,
        sendTime: new Date().toISOString()
      })
      nextTick(() => scrollToBottom())
      // 标记已读
      chatApi.markAsRead(data.senderId)
    }
  })
  
  // 群聊消息
  wsManager.on('groupChat', (data) => {
    // 更新群聊列表的最新消息
    updateGroupLastMessage(data.groupId, data.senderName, data.content, data.msgType || 1)
    
    // 如果是当前群聊的消息
    if (selectedGroup.value && data.groupId === selectedGroup.value.id) {
      groupMessages.value.push({
        id: Date.now(),
        groupId: data.groupId,
        senderId: data.senderId,
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        content: data.content,
        msgType: data.msgType || 1,
        sendTime: new Date().toISOString()
      })
      nextTick(() => scrollGroupToBottom())
    }
  })
}

onMounted(async () => {
  await loadUsers()
  loadGroups()
  setupWebSocket()
  
  // 检查是否有指定的群ID（从群聊通知跳转过来）
  const targetGroupId = route.query.groupId
  if (targetGroupId) {
    const groupId = parseInt(targetGroupId as string)
    const targetGroup = groups.value.find(g => g.id === groupId)
    if (targetGroup) {
      chatMode.value = 'group'
      selectGroup(targetGroup)
    }
  }
  // 检查是否有指定的用户ID（从私聊通知跳转过来）
  else {
    const targetUserId = route.query.userId
    if (targetUserId) {
      const userId = parseInt(targetUserId as string)
      const targetUser = users.value.find(u => u.id === userId)
      if (targetUser) {
        chatMode.value = 'private'
        selectUser(targetUser)
      }
    }
  }
})
</script>

<style scoped>
.chat-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  padding: 18px;
  overflow: hidden;
}

.chat-page-heading { flex: 0 0 auto; }

.chat-card {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 520px;
  max-width: none;
  max-height: none;
  position: relative;
}

.chat-card :deep(.n-card__content) {
  padding: 0 !important;
  min-height: 0;
  display: flex;
}

.chat-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

/* 全屏模式 */
.chat-fullscreen {
  position: fixed !important;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  margin: 0;
  border-radius: 0;
  z-index: 1000;
}

.chat-fullscreen :deep(.n-card__content) {
  height: 100%;
}

.chat-sidebar {
  min-width: 200px;
  max-width: 400px;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  flex-shrink: 0;
}

/* 拖拽分隔条 */
.resize-handle {
  width: 4px;
  background: transparent;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.2s;
  position: relative;
}

.resize-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 30px;
  background: #ddd;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.resize-handle:hover {
  background: #e8e8e8;
}

.resize-handle:hover::after {
  opacity: 1;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e8e8e8;
  background: #fff;
}

.contact-list {
  flex: 1;
  overflow-y: auto;
}

.contact-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.contact-item:hover {
  background: #f0f0f0;
}

.contact-item.active {
  background: #e8f5e9;
}

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.contact-name {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-time {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
  color: #333;
}

.contact-last-msg {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-last-msg .no-message {
  color: #ccc;
  font-style: italic;
}

.member-count-badge {
  font-size: 11px;
  color: #999;
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 10px;
}

.contact-status {
  font-size: 12px;
  margin-top: 2px;
}

.online {
  color: #18a058;
}

.offline {
  color: #999;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.chat-header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #e8e8e8;
  gap: 12px;
  background: #fff;
}

.chat-header-info {
  flex: 1;
}

.chat-header-name {
  font-size: 16px;
  font-weight: 500;
}

.chat-header-status {
  font-size: 12px;
}

.chat-header-actions {
  display: flex;
  gap: 4px;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #f5f7fa;
}

.loading-more {
  text-align: center;
  padding: 10px;
}

.message-item {
  display: flex;
  gap: 12px;
  max-width: 70%;
  transition: background 0.3s;
}

.message-item.message-self {
  flex-direction: row-reverse;
  margin-left: auto;
}

.message-item.message-highlight {
  background: #fff3cd;
  border-radius: 8px;
  padding: 4px;
  margin: -4px;
}

.message-content {
  display: flex;
  flex-direction: column;
}

.message-self .message-content {
  align-items: flex-end;
}

.message-bubble {
  padding: 10px 14px;
  background: #fff;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

.message-self .message-bubble {
  background: #18a058;
  color: #fff;
}

.message-image {
  max-width: 200px;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.message-image img {
  width: 100%;
  display: block;
}

.message-image:hover {
  opacity: 0.9;
}

.message-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.chat-input {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  background: #f5f7fa;
  border-top: 1px solid #e8e8e8;
  align-items: flex-end;
}

.input-toolbar {
  display: flex;
  gap: 4px;
  padding-bottom: 4px;
}

.input-area {
  flex: 1;
}

.chat-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

/* 表情面板 */
.emoji-panel {
  width: 320px;
}

.emoji-tabs {
  display: flex;
  gap: 4px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
  margin-bottom: 8px;
}

.emoji-tab {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
}

.emoji-tab:hover {
  background: #f0f0f0;
}

.emoji-tab.active {
  background: #e8f5e9;
}

.emoji-list {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.emoji-item {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.emoji-item:hover {
  background: #f0f0f0;
  transform: scale(1.2);
}

/* 快捷语面板 */
.quick-reply-panel {
  width: 280px;
}

.quick-reply-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.quick-reply-list {
  max-height: 250px;
  overflow-y: auto;
}

.quick-reply-item {
  padding: 8px 12px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  line-height: 1.5;
}

.quick-reply-item:hover {
  background: #f0f0f0;
  color: #18a058;
}

/* 快捷语编辑 */
.quick-reply-edit .edit-tip {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

/* 侧边栏标签 */
.sidebar-tabs {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #e8e8e8;
  gap: 4px;
}

.tab-item {
  padding: 6px 16px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.tab-item:hover {
  color: #18a058;
}

.tab-item.active {
  background: #e8f5e9;
  color: #18a058;
  font-weight: 500;
}

.member-count {
  color: #999;
  font-size: 12px;
}

/* 系统消息 */
.message-system {
  width: 100%;
  text-align: center;
}

.system-message {
  display: inline-block;
  padding: 4px 12px;
  font-size: 12px;
  color: #999;
  background: #f0f0f0;
  border-radius: 4px;
}

.message-sender {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

/* 群详情 */
.group-detail {
  min-height: 300px;
}

.member-actions {
  margin-bottom: 12px;
}

.member-list {
  max-height: 300px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  gap: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.member-item:last-child {
  border-bottom: none;
}

.member-info {
  flex: 1;
}

.member-name {
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-actions {
  text-align: center;
}

/* 搜索消息面板 */
.search-message-panel {
  width: 280px;
}

.search-results {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
}

.search-result-item:hover {
  background: #f5f5f5;
}

.result-content {
  font-size: 13px;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-time {
  font-size: 11px;
  color: #999;
  margin-left: 8px;
  flex-shrink: 0;
}

/* 用户资料弹窗 */
.user-profile {
  padding: 0 8px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.profile-username {
  font-size: 14px;
  color: #999;
  margin: 4px 0 8px;
}

/* 拉黑相关样式 */
.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.online-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background: #18a058;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(24, 160, 88, 0.3);
}

.blocked-icon {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: #fff;
  border-radius: 50%;
}

.contact-item.blocked {
  opacity: 0.7;
}

.blocked-text {
  color: #999 !important;
}

.blocked-msg {
  color: #d03050;
  font-size: 12px;
}

@media (max-width: 900px) {
  .chat-page { padding: 12px; }
  .chat-page-heading .admin-page-heading__description { display: none; }
  .chat-sidebar { width: 230px !important; min-width: 190px; }
}

@media (max-width: 640px) {
  .chat-page-heading { display: none; }
  .chat-card { min-height: calc(100vh - 110px); }
  .chat-sidebar { width: 190px !important; }
}

</style>
