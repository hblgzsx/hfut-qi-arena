# -*- coding: utf-8 -*-
# -*- coding: utf-8 -*-
"""Build the event-specific Chinese PDF runbook. Screenshots contain test data only."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from PIL import Image
import fitz

ROOT=Path(__file__).resolve().parents[1]
ART=Path('C:/Users/lenovo/.codex/visualizations/2026/11/18/01a1ed23-cd35-7d01-b9ce-0f79ba41a613')
OUT=ROOT/'output/pdf/弈境赛事操作流程与文件发送安排-2026-11-29.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('CN','C:/Windows/Fonts/simhei.ttf'))
W,H=595.28,841.89; M=42; CW=W-2*M
INK=HexColor('#203a49'); GREEN=HexColor('#286c5a'); GOLD=HexColor('#ae8241'); PALE=HexColor('#eef5f2'); LINE=HexColor('#cfddd8')
c=canvas.Canvas(str(OUT),pagesize=(W,H));c.setTitle('弈境赛事操作流程与文件发送安排 | 2026年11月29日');c.setAuthor('QI ARENA 组委会操作手册')
style=ParagraphStyle('body',fontName='CN',fontSize=10.2,leading=17,textColor=INK,wordWrap='CJK',spaceAfter=0)
small=ParagraphStyle('small',parent=style,fontSize=9,leading=14)
page=0;y=0
def p(text,width=CW,sty=style):return Paragraph(text,sty)
def text(s,space=8,sty=style):
 global y
 item=p(s,sty=sty);_,h=item.wrap(CW,H);assert y-h>51,(page,s[:45],y,h);item.drawOn(c,M,y-h);y-=h+space
def heading(s):
 global y
 y-=6;c.setFont('CN',13);c.setFillColor(GREEN);c.drawString(M,y,s);y-=21
def page_start(n,title,sub):
 global page,y
 if page:c.showPage()
 page=n;c.setFillColor(GREEN);c.rect(M,H-35,32,3,fill=1,stroke=0);c.setFont('CN',8);c.setFillColor(GREEN);c.drawString(M+42,H-36,'QI ARENA / 现场执行手册')
 c.setFillColor(INK);c.setFont('CN',23);c.drawString(M,H-82,title);c.setFont('CN',9);c.setFillColor(HexColor('#698074'));c.drawString(M,H-105,sub)
 c.setStrokeColor(LINE);c.line(M,43,W-M,43);c.setFont('CN',8);c.setFillColor(HexColor('#71867c'));c.drawString(M,28,'2026.11.29 · 14:00-18:00 · 科教楼 B 座 501 报告厅');c.drawRightString(W-M,28,f'{n:02d} / 09');y=H-131
def box(title,body):
 global y
 item=p(body,width=CW-28);_,h=item.wrap(CW-28,H);height=h+48;assert y-height>51,(page,title,y,height)
 c.setFillColor(PALE);c.roundRect(M,y-height,CW,height,8,fill=1,stroke=0);c.setFillColor(GREEN);c.setFont('CN',11);c.drawString(M+14,y-21,title);item.drawOn(c,M+14,y-36-h);y-=height+15
def table(headers,rows,widths):
 global y
 cells=[[p(escape(str(v)),sty=small) for v in row] for row in [headers]+rows]
 tb=Table(cells,colWidths=[CW*w for w in widths],hAlign='LEFT')
 tb.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#e5efea')),('GRID',(0,0),(-1,-1),.5,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))
 _,h=tb.wrap(CW,H);assert y-h>51,(page,'TABLE',y,h);tb.drawOn(c,M,y-h);y-=h+15
def image(name,height=190,crop=None):
 global y
 path=ART/name
 if crop:
  im=Image.open(path);im=im.crop(crop);path=ART/('manual-'+Path(name).stem+'.png');im.save(path)
 im=Image.open(path);width=min(CW,height*im.width/im.height);height=width*im.height/im.width
 assert y-height>51,(page,name,y,height)
 c.drawImage(str(path),M+(CW-width)/2,y-height,width=width,height=height,preserveAspectRatio=True);y-=height+7
 text('界面示意：验证用虚拟名单，不能作为正式参赛顺序。',space=10,sty=small)

page_start(1,'今晚锁定，明天按表执行','组委会操作流程 / 适用本次五院棋类友谊赛 / 更新：2026年11月28日')
box('本次已经确定的执行规则','今晚完成两项目抽签并锁定；明天未报到者保留原签位和对手，按弃权处理。<b>不从晋级树删除，不重新抽签。</b>五子棋默认 10 桌、军棋默认 5 桌；每桌独立安排裁判，一名裁判同场只负责一桌。')
heading('全流程只沿着这条线操作')
table(['阶段','操作','必须留下的文件'],[
 ['今晚 ①','创建比赛 → 配齐裁判 → 导入报名','裁判安排 PDF；账号登录信息（仅私发）'],
 ['今晚 ②','核对名单 → 编排优先 → 两项目各抽签一次','第一轮参赛顺序 PDF；锁定后 JSON 备份'],
 ['明天赛前','设备联网 → 裁判登录 → 报到核对','最新顺序表；必要时重发提醒'],
 ['明天 14:00 起','管理员启动调度 → 现场叫号 → 裁判录分','现场候场 PDF（按需）；定期 JSON 备份'],
 ['赛后','核对冠军、亚军、季军及争议更正','比赛成绩 PDF；记录表 PDF；最终 JSON']],[.16,.45,.39])
heading('进入系统')
text('地址：<link href="https://hblgzsx.github.io/hfut-qi-arena/" color="#286c5a">https://hblgzsx.github.io/hfut-qi-arena/</link><br/>先 Ctrl + F5 刷新，再用管理员账号登录。左侧下方“裁判与权限管理”管理账号；选择一场比赛后，“现场调度”才显示。')
text('本手册中的发送时间是建议执行时段，可按组委会实际进度前后调整。比赛时间和地点请以创建时填写、最终群通知为准。',sty=small)

page_start(2,'今晚第一步：创建与人员安排','先把比赛、棋盘和裁判确定下来，再导入名单与抽签')
heading('01 创建比赛：四步完成')
text('赛事中心 → “创建新竞赛”或左侧“添加竞赛”。<br/><b>赛事信息：</b>名称、举办学院、2026-11-29 14:00 至 18:00、地点；同时设置并确认赛事密码。<br/><b>赛制与奖项：</b>分别核对五子棋、军棋的季军人数和各轮赛制；需要军棋玩法时，在抽签前到规则页确定。<br/><b>棋盘与裁判：</b>默认五子棋 10、军棋 5；每桌点击“添加负责裁判”完成分配。同桌可有多人，同一裁判不能同时分配两桌。<br/><b>核对与创建：</b>建议开启自动备份并设为 10 分钟，核对后确认创建。默认备份原本关闭，需要主动打开。')
image('棋盘裁判编排-桌面.png',height=205,crop=(140,130,1400,850))
heading('02 保存裁判安排与登录信息')
text('创建成功 → 选中该赛事 → 现场调度 → 资料与打印 → “裁判与棋盘安排” → “下载裁判安排 PDF”。把这个正式版本发给裁判工作群，并打印现场用。')
box('密码分两种，发送对象也不同','裁判账号密码用于登录系统；赛事密码用于进入本赛事及验证管理修改。账号信息到“裁判与权限管理”按人员、字段选择导出，密码默认不勾选。新密码仅创建或重置后可导出，旧密码不可读取。<b>账号密码、赛事密码都不要放进公开参赛群。</b>')

page_start(3,'今晚第二步：核对名单与优先','这一步是抽签准备，不是明天的缺席判罚')
text('选中比赛 → “参赛选手” → “导入报名”。上传含五子棋、军棋两个工作表的 XLSX，核对预览后确认导入。姓名、学号、学院、性别应正确，学号作为身份核对依据；系统不保存报名表中的 QQ 和联系方式。')
heading('检录与抽签工作台怎么用')
text('现场调度 → 检录与抽签 → 分别选择五子棋、军棋。搜索姓名、学号或学院；可选每页 10/20/50/100 人或“全部显示”，也可通过页码、跳页下拉直接定位。名单不再放在固定高度的小滚动框中。')
image('检录工作台-白色.png',height=215,crop=(260,480,1570,1400))
table(['操作','系统实际含义'],[
 ['未报到标记','只是本机检录备注，不剔除报名、不自动判负。今晚仍保留其签位；明天由实际负责棋盘的裁判确认弃权。'],
 ['优先开赛','在抽签前加入优先名单，可上移、下移或指定位置。只提前首轮实赛叫号，不选择对手，不改随机轮空。'],
 ['批量操作','先勾选人员，可跨页选择；批量标记未报到、恢复，或批量设置优先。两个项目分开保存草稿。']],[.22,.78])
text('同一场的两位选手均优先时，取较前名次；优先选手若抽到首轮轮空，仍然轮空。双项目的优先顺序分别设置，系统调度时还会避开同一学号的兼项冲突。',sty=small)

page_start(4,'今晚核心：锁定并导出首轮顺序','这是今晚发给参赛群的正式对阵顺序文件')
heading('按这个顺序逐项点击')
text('① 在五子棋工作台完成优先编排，点击“确认全部名单并抽签锁定”。<br/>② 核对确认窗口：参与人数与报名人数一致；本次不剔除未报到者；优先人员与顺序正确。输入当前赛事密码和原因，再点“验证并保存修改”。<br/>③ 切换军棋，重复以上步骤。每个项目今晚只抽签一次。<br/>④ “资料与打印” → “第一轮参赛顺序” → 先点“第一轮参赛顺序预览”，核对两个项目和轮空名单，再点“下载第一轮参赛顺序 PDF”。<br/>⑤ 同页可打印或“复制群通知”。公开群发 PDF 时写清版本，随后下载一次完整 JSON 备份。')
image('第一轮顺序导出-预览.png',height=194,crop=(350,160,1240,640))
box('顺序表中，什么是固定的？','固定的是抽签后的对手、晋级路径、轮空和已保存的首轮候场队列。<b>候场序 1、2、3 不等于 14:00、14:10、14:20。</b>棋盘在实际叫号时分配；未叫号的场次显示“待现场叫号”。同学兼项、三分钟休息和桌面进度可能导致顺延。')
text('若五子棋实际为 89 人：128 签位、首轮 25 场实赛、39 人轮空。轮空不占用 10 张棋盘；首轮实赛按顺序候场，空一桌补一场。请以系统导出的实际人数为准。',sty=small)

page_start(5,'文件发给谁，什么时候发','所有发送均由组委会人工发送；系统生成文件或复制文本，不会自动替你发群')
table(['建议时段','导出 / 保存','接收对象与发送说明'],[
 ['11/28 今晚\n裁判配齐后','裁判安排 PDF\n资料与打印 → 裁判与棋盘安排','裁判工作群 + 现场打印。说明负责项目、桌号和提前到场时间。'],
 ['11/28 今晚\n账号创建后','按裁判选择登录信息 TXT/XLSX\n裁判与权限管理 → 选择导出','每名裁判私发其本人登录信息；赛事密码另行只发授权裁判。不要把全体密码表发公开群。'],
 ['11/28 今晚\n两项目锁定后','第一轮参赛顺序 PDF\n资料与打印 → 第一轮参赛顺序','参赛群 + 裁判群。注明“首轮已锁定”，报到时间地点、未报到按弃权、桌号以叫号为准。'],
 ['11/28 今晚\n锁定后立即','完整 JSON 备份\n赛事设置与备份 → 下载完整备份','仅组委会留档，另存电脑/移动介质。文件名标注“锁定后”。'],
 ['11/29 12:30-13:00\n建议提醒','重发同一版首轮 PDF + 报到提醒','参赛群。今晚未改队列则沿用原 PDF，不重新抽签；如确实更正，标明新版并撤回旧版。'],
 ['11/29 14:00 起\n现场有变化时','现场对阵与候场 PDF\n资料与打印 → 现场对阵与候场','现场工作人员；群内仅按需发。它是导出时的快照，比赛进行时以大屏实时叫号为准。'],
 ['11/29 比赛结束\n核对完成后','比赛成绩 PDF + 记录表 PDF\n最终 JSON 备份','参赛群可发成绩公告 PDF；详细原始记录与 JSON 由组委会留存。成绩有更正必须重导新版。']],[.23,.37,.40])
text('文件名建议：日期-赛事-材料名-v1；修改后使用 v2、v3，并注明导出时间。PDF 是阅读和打印资料，不能用于系统数据恢复；恢复必须使用 JSON。',sty=small)

page_start(6,'明天赛前与开赛：按时间执行','建议节奏 / 不用等整轮全部结束，一桌结束就补下一场')
table(['北京时间','负责人','具体动作'],[
 ['13:15-13:30','管理员 / 现场技术','摆好五子棋 1-10 桌、军棋 1-5 桌桌牌；核对网络、电源、大屏与打印件，检查自动备份已启用。'],
 ['13:30-13:45','裁判','提前登录裁判账号，核对负责桌号、领取赛事密码。赛事列表受比赛起止时间限制，14:00 前可能尚不可进入本场。'],
 ['13:45-13:55','检录人员','按学号报到核对，在本机工作台备注未报到者。不要删除报名，不重新导入名单，不重新抽签。备注仅本机保存，需向对应裁判交接。'],
 ['13:55-14:00','管理员','选中正确比赛；确认今晚首轮表、正式裁判安排与棋盘数一致。打开大屏，测试主屏语音设备；备好纸笔与锁定后 JSON。'],
 ['14:00','管理员 + 裁判','赛事进入有效时段，裁判输入赛事密码进入。管理员：现场调度 → 现场运行 → 开始/恢复自动叫号 → 输入密码和原因保存。'],
 ['14:00 起','主屏 / 负责裁判','叫号内容是“项目、棋盘编号、两位选手”。双方到齐后确认开赛；已叫号场次才有实际桌号。'],
 ['每桌结束后','负责裁判','录入并提交真实赛果。系统释放棋盘，优先按已保存队列补台；双方已确定的后轮可提前开始，须满足休息和兼项条件。']],[.19,.21,.60])
box('主屏播报与备份','语音只在指定主屏启用，避免多设备重复播报。自动备份建议 10 分钟；另在抽签锁定后、重要成绩更正后和赛后主动下载完整 JSON。断网期间不要反复提交或凭记忆改赛程，先记纸质现场记录。')

page_start(7,'缺席、弃权与裁判录分','未报到不会被系统定时自动判负，必须由当值裁判确认并提交结果')
heading('一方未报到，按弃权处理')
text('① 先确认这场已经实际叫号，核对桌号、场次 ID 和双方姓名/学号。未轮到叫号的候场选手，不应直接因暂时不在桌旁判负。<br/>② 裁判按组委会公布的报到与迟到规则核实，保留必要的叫号、联系或现场记录。系统规则页含迟到 5 分钟规定，起算口径须由组委会在通知中明确，不是所有候场选手统一在 14:05 判负。<br/>③ 打开自己负责棋盘的该场对局，在“成绩类型”选择“一方弃权 / 取消资格”；界面选择的是<b>晋级方 / 胜方</b>，务必选择到场的选手，不能误选缺席者。<br/>④ 填写原因（例如：该场实际叫号后经裁判确认，B 方未报到，按弃权处理），提交后核对对手晋级和桌面释放。不得伪造 2:0 或虚构已进行的棋局。')
heading('双方都未报到')
text('选择“双方弃权 / 取消资格”，填写原因并确认。该对局不产生胜者；空位沿固定路径向后传播。原先确定的其他对手与轮空保留，系统不会临时补进新选手。')
heading('正常对局')
text('按真实比赛录入每局结果、首局先手、裁判姓名与必要说明。一局制达到一胜结束；三局两胜达到两胜结束；和棋不计胜局，继续加赛。未分胜负时仅保存真实已完成的局，不提前填胜方。')
box('最容易选反的一步','弃权时填写“谁晋级”，不是点“谁缺席”。提交前把桌号、A/B 选手、晋级方和原因再读一遍。裁判只能提交自己被绑定棋盘的对局；需要更正已经结束的赛果时，交给管理员核查后处理。')
text('选手结束上一场后至少休息 3 分钟；同一学号不能同时占用两个项目棋盘。主屏下一场分配以系统实际叫号为准。',sty=small)

page_start(8,'更正、备份与赛后归档','保住今晚抽签结果；修改先核对影响，执行后保存新版文件')
table(['遇到的情况','正确操作'],[
 ['明天有人没来','原签位保留。由负责棋盘的裁判确认后录入一方/双方弃权；不要删除、重导名单或重新抽签。'],
 ['只想调整叫号顺序','现场运行 → 调整候场顺序；只调整原有场次顺序。保存时验证赛事密码和原因，不改变对手、轮空，已叫号对局保留原桌。随后重导首轮表并更新版本。'],
 ['改棋盘或裁判','先暂停补台，核查桌面已有对局；到“棋盘与裁判”编辑，保存后再输入赛事密码和原因。每桌至少一名不同裁判，一人仅一桌。'],
 ['比分填错','管理员核对原始记录与受影响下游；不要在已影响叫号的情况下盲目改旧结果。更正后复核晋级、现场桌面与署名，导出更新后的成绩/顺序文件。'],
 ['网络故障','保留当前现场与纸质记录，停止重复点提交。网络恢复后先刷新核对服务器结果，再补录尚未保存的真实赛果。不要把过期整场 JSON 直接覆盖正在进行的比赛。'],
 ['需要恢复备份','仅管理员在“赛事设置与备份 → 恢复 JSON 备份”校验并确认。先另存当前版本；涉及受保护变化时按页面验证密码和原因。恢复会覆盖数据，需先核查现场。']],[.23,.77])
heading('赛后 4 步')
text('1. 核对两项目全部实际赛果、弃权原因及冠军/亚军/季军。<br/>2. 资料与打印 → “比赛成绩归档” → 下载比赛成绩 PDF。未完赛时导出会标为阶段性快照，不能当最终成绩公告。<br/>3. 晋级对阵 → 对应项目全部可进行的对局结束后 → “导出记录 PDF”；分别保存两项目原始记录表。<br/>4. 下载最终完整 JSON；归档成绩 PDF、记录表、今晚首轮锁定表及裁判安排。确认后向参赛群发布成绩公告。')

page_start(9,'今晚发群文案与明天速查','可复制后改成实际赛事名称、版本和组委会公布的迟到口径')
box('今晚首轮顺序公告模板','各位同学：11 月 29 日 14:00-18:00，科教楼 B 座 501 报告厅举行五院棋类友谊赛。请于 13:45 前到场报到。附件为【第一轮参赛顺序 v1】，对手与轮空已锁定；未报到者按现场规则确认弃权，不重新抽签。候场序号不是固定开赛时间，桌号以现场实际叫号为准。首轮轮空同学请保持可联系，等待下一轮叫号。请以本条最新附件为准。')
heading('开赛前最后核对')
table(['检查项','完成标准'],[
 ['真实顺序文件','两项目均完成锁定，实赛顺序和轮空分别列出；尚未叫号的场次没有虚构棋盘号。'],
 ['裁判与密码','15 桌裁判配齐；每人知道自己的桌号。账号密码和赛事密码没有进入公开顺序表或参赛群。'],
 ['备份','已启用每 10 分钟自动备份；今晚锁定后的 JSON 已额外保存。'],
 ['明天不改签位','不重新导入、不剔除未报到者、不重新抽签；缺席按真实对局录入弃权。'],
 ['现场节奏','14:00 启动调度；主屏叫到哪桌哪两人，裁判只管对应桌。完赛即补台，休息满 3 分钟。'],
 ['赛后文件','核对最终成绩后再发成绩 PDF，原始记录和最终 JSON 留组委会归档。']],[.25,.75])
text('<b>今晚真正需要你执行的最短路径：</b><br/>创建比赛并配齐裁判 → 导入两项目报名 → 检录与抽签分别锁定 → 资料与打印 → 第一轮参赛顺序 → 下载 PDF → 人工发群 → 下载 JSON。')
text('本手册包含的是操作流程和界面示例，并非你当前真实赛事的顺序名单。真实 PDF 必须从你选中的比赛、已锁定的正式数据导出；示例图与演示导出文件均使用虚拟名单，不可发送给实际参赛者。',sty=small)
c.save()
doc=fitz.open(OUT)
assert len(doc)==9
for i in range(len(doc)):
 doc[i].get_pixmap(matrix=fitz.Matrix(1.25,1.25)).save(str(ART/f'操作流程手册-第{i+1:02d}页.png'))
print(str(OUT));print('pages',len(doc),'text chars',sum(len(page.get_text()) for page in doc))
