"use client";
import styles from "./galaxies.module.css";
import { cn } from "@/lib/utils";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Boxes, Heart, MessageSquare, Sparkles, Star, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/community/empty-state";
import { Button } from "@/components/ui/button";
import { communityApi, type GalaxyContentItem, type GalaxyMember } from "@/lib/community-api";
import { useAsyncData } from "@/lib/use-async-data";

function compactCount(value=0){return value>=10000?`${(value/10000).toFixed(1)}万`:String(value)}

export default function GalaxiesPage(){
  const {data:galaxies,loading,error}=useAsyncData(()=>communityApi.getGalaxies(),[]);
  const featured=galaxies?.[0];
  const [works,setWorks]=useState<GalaxyContentItem[]>([]);
  const [members,setMembers]=useState<GalaxyMember[]>([]);
  useEffect(()=>{if(!featured)return;void Promise.allSettled([communityApi.getGalaxyContent(featured.slug,3),communityApi.getGalaxyMembers(featured.slug,8)]).then(([content,memberResult])=>{if(content.status==="fulfilled")setWorks(content.value);if(memberResult.status==="fulfilled")setMembers(memberResult.value)})},[featured?.slug]);
  if(loading)return <AppShell><main className={cn(styles.home)}><section className={cn(styles.feature, styles.loading)}><div className={cn(styles.loadingCopy)}><span/><i/><b/></div><div className={cn(styles.loadingArt)}/></section><div className={cn(styles.loadingRow)}><span/><span/><span/></div></main></AppShell>;
  if(error)return <AppShell><main className={cn(styles.home)}><EmptyState title="星系加载失败" description={error}/></main></AppShell>;
  if(!featured)return <AppShell><main className={cn(styles.home)}><EmptyState title="暂无星系" description="星系创建后会显示在这里" actionLabel="去发现" actionHref="/discover"/></main></AppShell>;
  return <AppShell><main className={cn(styles.home)}>
    <section className={cn(styles.feature)}>
      <div className={cn(styles.orbitImage)}><Image src="/prototype-assets/galaxies/featured-orbit.png" alt="远航者星系" fill priority/></div>
      <div className={cn(styles.featureCopy)}><span className={cn(styles.kicker)}>{featured.official?"官方星系":"社区星系"} <Sparkles/></span><h1>{featured.name}</h1><h2>以公开内容为线索，连接同频的创作与讨论。</h2><p>进入这个星系，浏览已关联的内容并认识正在参与共创的社区成员。</p><div className="flex gap-4"><Button className="rounded-xl px-7" asChild><Link href={`/galaxies/${featured.slug}`}><Star className="mr-2 h-4 w-4"/>查看星系</Link></Button><Button variant="outline" className="rounded-xl px-6" asChild><Link href={`/galaxies/${featured.slug}/content`}><Users className="mr-2 h-4 w-4"/>进入内容流</Link></Button></div></div>
      <aside className={cn(styles.theme)}><span><Sparkles/>星系探索</span><h2>在共创中留下内容轨迹</h2><p>公开内容、成员与项目会持续汇集在这里，成为可以再次回看的社区资产。</p><Link href={`/galaxies/${featured.slug}`}>查看星系详情 <ArrowRight/></Link><small>{featured.memberCount===undefined?"成员数据暂未提供":`${compactCount(featured.memberCount)} 位成员`}</small></aside>
    </section>
    <div className={cn(styles.homeLayout)}><div>
      <div className={cn(styles.sectionTitle)}><h2><Sparkles/>代表作品</h2><Link href={`/galaxies/${featured.slug}/content`}>查看全部 <ArrowRight/></Link></div>
      <section className={cn(styles.works, works.length === 0 && styles.isEmpty)}>{works.length?works.map((work,index)=><Link href={`/galaxies/${featured.slug}/content`} className={cn(styles.work, index===0 && styles.isLarge)} key={work.id}><Image src={`/prototype-assets/galaxies/${["work-map","work-trust","work-toolbox"][index]}.png`} alt="" aria-hidden="true" fill/><div>{work.pinned&&<b>置顶</b>}<h3>{work.title||"内容标题暂未提供"}</h3><p>{work.objectType}</p><span>互动数据暂未提供</span></div></Link>):<p className={cn(styles.empty)}>暂无已关联的公开内容。</p>}</section>
      <div className={cn(styles.sectionTitle)}><h2><Sparkles/>共创成员</h2><small>成员按加入记录展示</small></div><div className={cn(styles.creators)}>{members.length?members.map(member=><Link href={`/u/${member.username}`} key={member.userId}><span>{(member.displayName||member.username).slice(0,1)}</span><b>{member.displayName||member.username}</b><small>{member.role||"成员"}</small></Link>):<p className={cn(styles.empty)}>暂无可展示的成员。</p>}</div>
      <div className={cn(styles.tabs)}><b>相关星系</b></div><div className={cn(styles.seriesCards)}>{(galaxies??[]).slice(1,3).map((g,i)=><Link href={`/galaxies/${g.slug}`} key={g.id}><Image src={`/prototype-assets/galaxies/${i?'work-trust':'work-map'}.png`} alt="" aria-hidden="true" width={105} height={90}/><div><b>{g.name}</b><p>{g.official?"官方运营的公开星系":"社区创建的公开星系"}</p><small>{g.memberCount===undefined?"成员数据暂未提供":`${compactCount(g.memberCount)} 位成员`}</small></div><span className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium">查看</span></Link>)}</div>
    </div><aside className={cn(styles.stats)}><section><h2><BookOpen/>星系公开数据</h2>{[['成员数',featured.memberCount===undefined?'暂未提供':compactCount(featured.memberCount)],['关联内容',works.length?`${works.length} 条`:'暂未提供'],['公开状态',featured.official?'官方星系':'社区星系']].map(([k,v])=><div key={k}><span>{k}</span><b>{v}</b></div>)}</section><section><h2><Users/>关联交流群</h2><p>群聊关联数据暂未提供。星系讨论会通过内容区与后续开放的群聊入口承接。</p></section></aside></div>
  </main></AppShell>;
}
