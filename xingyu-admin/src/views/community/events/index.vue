<template>
  <div class="event-review-page">
    <header class="review-page-head">
      <div><h1>活动审核</h1><p>审核社区内用户提交的活动，确保内容合规</p></div>
      <n-space><n-badge :value="pendingCount"><n-button quaternary @click="statusFilter = 'PENDING'">待办</n-button></n-badge><n-button @click="showManage = true">活动列表</n-button><n-button type="primary" @click="openCreate">新建活动</n-button></n-space>
    </header>

    <div class="review-workspace">
      <section class="review-queue">
        <nav><button :class="{ active: statusFilter === 'PENDING' }" @click="statusFilter = 'PENDING'">待审核 <b>{{ pendingCount }}</b></button><button :class="{ active: statusFilter === 'ACTIVE' }" @click="statusFilter = 'ACTIVE'">已通过</button><button :class="{ active: statusFilter === 'ARCHIVED' }" @click="statusFilter = 'ARCHIVED'">已驳回</button><button :class="{ active: statusFilter === 'ALL' }" @click="statusFilter = 'ALL'">全部</button></nav>
        <div class="queue-sort">最新提交⌄</div>
        <div class="queue-list" :class="{ loading }">
          <button v-for="(event,index) in displayEvents" :key="event.id" :class="{ selected:selectedEvent?.id===event.id }" @click="selectEvent(event)">
            <img loading="lazy" decoding="async" :src="`/prototype-assets/activity-review/list-${index%4+1}.png`" alt="" />
            <span><b>{{ event.title }}</b><small>活动状态：{{ event.status }}</small><small>活动时间：{{ formatRange(event) }}</small><small>投稿：{{ event.submissionOpen ? '开放中' : '暂未开放' }}</small></span>
            <em>{{ event.status }}</em><i class="low">{{ event.submissionOpen ? '可投稿' : '已关闭' }}</i>
          </button>
        </div>
        <footer>共 {{ displayEvents.length }} 条　　‹　 1　 2　 ›</footer>
      </section>

      <section v-if="selectedEvent" class="review-detail">
        <header><h2>活动详情</h2><span>状态：{{ selectedEvent.status }}</span></header>
        <div class="detail-summary"><img src="/prototype-assets/activity-review/detail-cover.png" alt="活动封面" /><dl><dt>活动标题</dt><dd>{{ selectedEvent.title }}</dd><dt>活动别名</dt><dd>{{ selectedEvent.slug }}</dd><dt>活动时间</dt><dd>{{ formatRange(selectedEvent) }}</dd><dt>投稿状态</dt><dd>{{ selectedEvent.submissionOpen ? '开放投稿' : '暂未开放投稿' }}</dd><dt>活动状态</dt><dd><n-tag :type="selectedEvent.status === 'ACTIVE' ? 'success' : 'warning'" size="small">{{ selectedEvent.status }}</n-tag></dd></dl></div>
        <div class="detail-tabs"><strong>活动说明</strong></div>
        <div class="detail-body"><article><h3>活动介绍</h3><p>{{ selectedEvent.body || '该活动暂未填写说明。' }}</p><h3>活动设置</h3><ul><li>活动状态：{{ selectedEvent.status }}</li><li>投稿状态：{{ selectedEvent.submissionOpen ? '开放投稿' : '暂未开放投稿' }}</li></ul></article><aside><h3>活动资源</h3><p>封面图</p><img class="poster" src="/prototype-assets/activity-review/poster.png" alt="活动封面示意" /><p>当前活动接口未提供活动资源列表。</p><n-button block @click="openSubmissions(selectedEvent)">查看投稿</n-button></aside></div>
        <footer><n-button size="large" type="error" ghost @click="reviewEvent('ARCHIVED')">⊗ 拒绝通过</n-button><n-button size="large" type="primary" :loading="reviewing" @click="reviewEvent('ACTIVE')">✓ 审核通过</n-button></footer>
      </section>
    </div>

    <n-modal v-model:show="showManage" preset="card" title="活动列表管理" style="width:780px"><n-data-table :columns="columns" :data="events" :loading="loading" /></n-modal>
    <n-modal v-model:show="showModal" preset="card" :title="editing?'编辑活动':'新建活动'" style="width:640px"><n-form ref="eventFormRef" :model="form" :rules="eventRules" label-placement="left" label-width="90"><n-form-item label="标题" path="title"><n-input v-model:value="form.title" /></n-form-item><n-form-item label="别名" path="slug"><n-input v-model:value="form.slug" :disabled="!!editing" /></n-form-item><n-form-item label="正文"><n-input v-model:value="form.body" type="textarea" :rows="6" /></n-form-item><n-form-item label="开放投稿"><n-switch v-model:value="form.submissionOpen" /></n-form-item></n-form><template #footer><n-space justify="end"><n-button @click="showModal=false">取消</n-button><n-button type="primary" :loading="saving" @click="save">保存</n-button></n-space></template></n-modal>
    <n-drawer v-model:show="showSubmissions" :width="720" placement="right"><n-drawer-content :title="`投稿审核 · ${reviewingEvent?.title??''}`" closable><n-data-table v-if="submissions.length || submissionsLoading" :columns="submissionColumns" :data="submissions" :loading="submissionsLoading" /><div v-else class="submission-empty">当前活动暂无投稿</div></n-drawer-content></n-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { NButton, NTag, useMessage, type DataTableColumns, type FormInst, type FormRules } from 'naive-ui'
import { eventApi, type CommunityEvent, type EventSubmission } from '@/api/events'

const message=useMessage();const loading=ref(false);const saving=ref(false);const reviewing=ref(false);const events=ref<CommunityEvent[]>([]);const selectedEvent=ref<CommunityEvent|null>(null);const showManage=ref(false);const showModal=ref(false);const editing=ref<CommunityEvent|null>(null);const showSubmissions=ref(false);const reviewingEvent=ref<CommunityEvent|null>(null);const submissions=ref<EventSubmission[]>([]);const submissionsLoading=ref(false);const form=ref({title:'',slug:'',body:'',status:'ACTIVE',submissionOpen:true});const eventFormRef=ref<FormInst|null>(null);
const eventRules:FormRules={title:[{required:true,message:'请输入活动标题',trigger:['input','blur']}],slug:[{required:true,message:'请输入活动别名',trigger:['input','blur']},{pattern:/^[a-z0-9]+(?:-[a-z0-9]+)*$/,message:'仅支持小写字母、数字和连字符',trigger:['input','blur']}]}
const statusFilter=ref<'ALL'|'PENDING'|'ACTIVE'|'ARCHIVED'>('PENDING')
const pendingCount=computed(()=>events.value.filter(x=>x.status!=='ACTIVE'&&x.status!=='ARCHIVED').length)
const displayEvents=computed(()=>statusFilter.value==='ALL'?events.value:statusFilter.value==='PENDING'?events.value.filter(x=>x.status!=='ACTIVE'&&x.status!=='ARCHIVED'):events.value.filter(x=>x.status===statusFilter.value))
const columns:DataTableColumns<CommunityEvent>=[{title:'活动标题',key:'title'},{title:'状态',key:'status',render:r=>h(NTag,{type:r.status==='ACTIVE'?'success':'warning'},()=>r.status)},{title:'操作',key:'actions',render:r=>h('div',{class:'submission-actions'},[
  h(NButton,{size:'small',onClick:()=>{selectedEvent.value=r;showManage.value=false}},()=> '审核'),
  h(NButton,{size:'small',onClick:()=>openEdit(r)},()=> '编辑'),
  h(NButton,{size:'small',type:'primary',ghost:true,onClick:()=>openSubmissions(r)},()=> '投稿')
])}];
const submissionColumns:DataTableColumns<EventSubmission>=[{title:'作者',key:'authorDisplayName'},{title:'内容',key:'objectTitle'},{title:'状态',key:'status'},{title:'操作',key:'actions',render:r=>h('div',{class:'submission-actions'},[h(NButton,{size:'small',type:'primary',onClick:()=>reviewSubmission(r.id,'ACCEPTED')},()=> '通过'),h(NButton,{size:'small',type:'error',onClick:()=>reviewSubmission(r.id,'REJECTED')},()=> '拒绝')])}];
function formatRange(event:CommunityEvent){return [event.startsAt,event.endsAt].filter(Boolean).join(' – ') || '暂未设置'}
async function load(){loading.value=true;try{events.value=await eventApi.list();selectedEvent.value=events.value[0]||null}catch{events.value=[];selectedEvent.value=null;message.error('活动列表暂时无法加载，请检查服务连接后重试')}finally{loading.value=false}}
function selectEvent(event:CommunityEvent){selectedEvent.value=event}
function openCreate(){editing.value=null;form.value={title:'',slug:'',body:'',status:'ACTIVE',submissionOpen:true};showModal.value=true}
function openEdit(event:CommunityEvent){editing.value=event;form.value={title:event.title,slug:event.slug,body:event.body||'',status:event.status,submissionOpen:event.submissionOpen};showManage.value=false;showModal.value=true}
async function save(){try{await eventFormRef.value?.validate()}catch{return}saving.value=true;try{if(editing.value)await eventApi.update(editing.value.id,form.value);else await eventApi.create(form.value);message.success('保存成功');showModal.value=false;await load()}catch{message.error('保存失败')}finally{saving.value=false}}
async function reviewEvent(status:'ACTIVE'|'ARCHIVED'){if(!selectedEvent.value)return;reviewing.value=true;try{await eventApi.update(selectedEvent.value.id,{status});message.success(status==='ACTIVE'?'审核通过':'已拒绝');await load()}catch{message.error('审核操作失败')}finally{reviewing.value=false}}
async function openSubmissions(row:CommunityEvent){reviewingEvent.value=row;showSubmissions.value=true;submissionsLoading.value=true;try{submissions.value=await eventApi.listSubmissions(row.id)}catch{message.error('加载投稿失败')}finally{submissionsLoading.value=false}}
async function reviewSubmission(id:string,status:'ACCEPTED'|'REJECTED'){try{await eventApi.reviewSubmission(id,status);message.success(status==='ACCEPTED'?'已通过':'已拒绝');if(reviewingEvent.value)submissions.value=await eventApi.listSubmissions(reviewingEvent.value.id)}catch{message.error('审核失败')}}
onMounted(load)
</script>

<style scoped>
.event-review-page{min-height:calc(100vh - 108px);display:flex;flex-direction:column;color:#172033}.review-page-head{min-height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 16px}.review-page-head>div{display:flex;align-items:center;gap:18px}.review-page-head h1{font-size:26px;margin:0}.review-page-head p{margin:0;color:#667085}.review-workspace{flex:1;min-height:0;display:grid;grid-template-columns:505px 1fr;gap:12px}.review-queue,.review-detail{background:#fff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden}.review-queue{display:flex;min-height:640px;flex-direction:column}.review-queue>nav{height:56px;display:flex;border-bottom:1px solid #e4e7ec}.review-queue>nav button{flex:1;border:0;background:#fff;font-size:15px}.review-queue>nav button.active{color:#f26722;border-bottom:2px solid #f26722}.review-queue>nav b{background:#fff0e7;border-radius:12px;padding:2px 7px}.queue-sort{padding:12px 18px}.queue-list{flex:1;overflow:auto;padding:0 8px}.queue-list>button{position:relative;width:100%;display:grid;grid-template-columns:152px 1fr;gap:16px;text-align:left;border:0;border-bottom:1px solid #eaecf0;background:#fff;padding:12px}.queue-list>button.selected{border:1px solid #ff7a2d;border-radius:8px}.queue-list img{width:152px;height:116px;object-fit:cover;border-radius:5px}.queue-list button:first-child img{height:136px}.queue-list span{display:flex;flex-direction:column;gap:7px}.queue-list span>b{font-size:16px}.queue-list small{color:#667085}.queue-list em,.queue-list i{position:absolute;right:14px;font-style:normal;padding:3px 8px;border-radius:5px}.queue-list em{top:14px;background:#fff1de;color:#e76d1d}.queue-list i{bottom:14px}.queue-list i.medium{background:#fff0f0;color:#f04438}.queue-list i.low{background:#eaf7ed;color:#2f9e55}.review-queue>footer{height:48px;padding:14px 18px}.review-detail{display:flex;min-height:640px;flex-direction:column}.review-detail>header{display:flex;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #e4e7ec}.review-detail h2{font-size:20px;margin:0}.review-detail>header span{color:#98a2b3}.detail-summary{display:grid;grid-template-columns:275px 1fr;gap:26px;padding:22px}.detail-summary>img{width:275px;height:235px;object-fit:cover;border-radius:6px}.detail-summary dl{display:grid;grid-template-columns:90px 1fr;gap:14px 18px;margin:0}.detail-summary dt{font-weight:600}.detail-summary dd{margin:0;color:#667085}.detail-tabs{display:flex;border-block:1px solid #e4e7ec}.detail-tabs button{padding:16px 24px;border:0;background:#fff}.detail-tabs button.active{color:#f26722;border-bottom:2px solid #f26722}.detail-body{flex:1;min-height:0;display:grid;grid-template-columns:1.3fr 1fr}.detail-body>article,.detail-body>aside{padding:22px;border-right:1px solid #e4e7ec}.detail-body h3{margin:0 0 14px}.detail-body p,.detail-body li{line-height:1.8;color:#667085}.detail-body .poster{width:151px;height:80px;object-fit:cover}.detail-body aside>div{display:flex;gap:12px;margin:10px 0 18px}.detail-body aside>div img{width:98px;height:105px;object-fit:cover}.review-detail>footer{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;padding:20px;border-top:1px solid #e4e7ec}.review-detail>footer .n-button:last-child{background:#f26700}.submission-actions{display:flex;gap:8px}.submission-empty{display:grid;min-height:280px;place-items:center;color:#8893a5;font-size:14px}@media(max-width:1200px){.review-workspace{grid-template-columns:420px 1fr}.detail-summary{grid-template-columns:200px 1fr}.detail-summary>img{width:200px}}@media(max-width:900px){.review-workspace{grid-template-columns:1fr}.review-page-head{align-items:flex-start;flex-direction:column;gap:12px;padding-block:14px}.review-queue,.review-detail{min-height:auto}.review-page-head p{display:none}}
.detail-tabs{padding:16px 24px;color:#f26722}
.review-detail>footer{grid-template-columns:1fr 1fr}
</style>
