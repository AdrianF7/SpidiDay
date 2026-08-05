(function () {
  'use strict';
  const DAILY_CUTOFF_HOUR = 22;
  const DAILY_CUTOFF_MINUTE = 0;
  const db = window.AdriDB;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = value => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(value)||0);
  let nowProvider = () => new Date();
  let finalizing = null;
  let dialogOpener = null;

  function getNow() { return new Date(nowProvider().getTime()); }
  function setNowProvider(provider) { nowProvider = provider || (() => new Date()); }
  function getLocalDate(value = getNow()) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function localDateObject(localDate) { return new Date(`${localDate}T00:00:00`); }
  function getLocalDayStart(localDate) { return localDateObject(localDate); }
  function getLocalCutoff(localDate) { const date=localDateObject(localDate); date.setHours(DAILY_CUTOFF_HOUR,DAILY_CUTOFF_MINUTE,0,0); return date; }
  function timezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'; }
  function dateText(date) { return new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${date}T12:00:00`)); }
  function timeText(value) { return value ? new Intl.DateTimeFormat('es-CO',{hour:'numeric',minute:'2-digit'}).format(new Date(value)) : ''; }
  function request(request) { return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}); }
  function completionTime(completion, localDate) {
    if (completion?.completedAt || completion?.createdAt || completion?.updatedAt) return new Date(completion.completedAt||completion.createdAt||completion.updatedAt);
    return completion ? new Date(`${localDate}T21:59:59`) : null;
  }
  function routineScheduled(routine, localDate) {
    const weekday=new Date(`${localDate}T12:00:00`).getDay(), created=routine.createdAt?getLocalDate(routine.createdAt):'0000-00-00';
    const ended=routine.archivedAt||routine.deletedAt||routine.inactiveAt;
    return Array.isArray(routine.days)&&routine.days.includes(weekday)&&created<=localDate&&(!ended||getLocalDate(ended)>localDate)&&(routine.active!==false||!ended||getLocalDate(ended)>localDate);
  }
  async function buildSnapshot(localDate, legacy) {
    const [routines,completions,shorts,expenses,categories,verse,journals]=await Promise.all([
      db.all('routines'),db.all('completions'),db.all('shortHabitCompletions'),db.all('expenses'),db.all('categories'),db.get('dailyVerses',localDate),db.all('verseJournalEntries')
    ]);
    const cutoff=getLocalCutoff(localDate), legacyHabits=legacy?.habitSnapshot||legacy?.habits;
    let habitSnapshot;
    if (Array.isArray(legacyHabits)&&legacyHabits.length) habitSnapshot=legacyHabits.map(h=>({
      habitId:h.habitId||h.id,name:h.name||'Hábito',scheduledTime:h.scheduledTime||h.time||'',period:h.period||'',difficulty:h.difficulty||'',scheduledForDate:localDate,
      status:h.status||(h.completed?'completed':'incomplete'),completedAt:h.completedAt||null,completedBeforeCutoff:h.completedBeforeCutoff??!!h.completed
    }));
    else habitSnapshot=routines.filter(r=>routineScheduled(r,localDate)).map(r=>{
      const complete=completions.find(c=>c.routineId===r.id&&c.date===localDate), short=shorts.find(c=>c.routineId===r.id&&c.date===localDate), completedAt=completionTime(complete,localDate);
      const status=complete?'completed':short?.status==='completed'?'short_version':short?.status==='omitted'?'skipped':'incomplete';
      return {habitId:r.id,name:r.name,scheduledTime:r.time||'',period:r.period||'',difficulty:r.difficulty||'',scheduledForDate:localDate,status,completedAt:completedAt?.toISOString()||null,completedBeforeCutoff:status==='completed'&&completedAt<=cutoff};
    });
    const expenseSnapshot=expenses.filter(e=>e.date===localDate).map(e=>({expenseId:e.id,category:e.categoryName||categories.find(c=>c.id===e.categoryId)?.name||'Sin categoría',description:e.description||'',amount:Number(e.amount)||0,time:e.time||e.createdAt||e.updatedAt||null,payment:e.payment||''}));
    let verseSnapshot=legacy?.verseSnapshot||legacy?.verse||null;
    if (!verseSnapshot&&verse) verseSnapshot=window.RV1909_VERSES?.find(v=>v.id===verse.verseId)||verse;
    const journal=journals.find(j=>j.verseDate===localDate);
    const reflection=legacy?.reflectionSnapshot||legacy?.reflection||journal?.reflection||null;
    const reflectionSnapshot=reflection?(typeof reflection==='object'?reflection:{text:reflection}):null;
    return {habitSnapshot,expenseSnapshot,totalSpent:expenseSnapshot.reduce((sum,e)=>sum+e.amount,0),verseSnapshot,reflectionSnapshot,mood:legacy?.mood||null};
  }
  function counts(snapshot) {
    const completed=snapshot.habitSnapshot.filter(h=>h.status==='completed'&&h.completedBeforeCutoff).length;
    return {scheduled:snapshot.habitSnapshot.length,completed,incomplete:snapshot.habitSnapshot.filter(h=>h.status!=='completed'||!h.completedBeforeCutoff).length,short:snapshot.habitSnapshot.filter(h=>h.status==='short_version').length};
  }
  function currentState(snapshot, localDate, now=getNow()) {
    const count=counts(snapshot);
    if (!count.scheduled) return now>=getLocalCutoff(localDate)?'no_goals':'open';
    if (count.completed===count.scheduled) return now<getLocalCutoff(localDate)?'ready_to_close':'completed';
    return now>=getLocalCutoff(localDate)?'incomplete':'open';
  }
  function shuffled(ids) {
    const result=[...ids], random=new Uint32Array(Math.max(1,result.length));
    if (crypto?.getRandomValues) crypto.getRandomValues(random); else random.forEach((_,i)=>random[i]=(Date.now()+i*2654435761)>>>0);
    for(let i=result.length-1;i>0;i--){const j=random[i]% (i+1);[result[i],result[j]]=[result[j],result[i]]} return result;
  }
  function officialMessages(type){return type==='success'?window.SPIDIDAY_SUCCESS_MESSAGES||[]:type==='support'?window.SPIDIDAY_SUPPORT_MESSAGES||[]:[]}
  function officialMessage(type,text){return officialMessages(type).find(message=>message.text===text)||null}
  async function assignMessage(type) {
    if (!type) return null;
    const messages=officialMessages(type);
    if (!messages?.length) throw new Error('No se cargaron los mensajes locales.');
    let pool=await db.get('motivationPools',type);
    if (!pool||!Array.isArray(pool.remainingIds)) pool={id:type,remainingIds:[],usedIds:[],cycle:0,lastId:null};
    if (!pool.remainingIds.length) {
      let ids=shuffled(messages.map(m=>m.id));
      if(pool.lastId&&ids.length>1&&ids[0]===pool.lastId)[ids[0],ids[1]]=[ids[1],ids[0]];
      pool={...pool,remainingIds:ids,usedIds:[],cycle:(pool.cycle||0)+1};
    }
    const id=pool.remainingIds.shift(), message=messages.find(m=>m.id===id), assignedAt=getNow().toISOString();
    pool.usedIds.push(id);pool.lastId=id;pool.updatedAt=assignedAt;await db.put('motivationPools',pool);
    return {motivationMessageId:id,motivationMessageText:message.text,motivationMessageType:type,motivationAssignedAt:assignedAt};
  }
  async function finalizeDay(localDate, source='automatic', forceStatus=null) {
    if(finalizing) return finalizing;
    finalizing=(async()=>{
      const existing=await db.get('dailyHistory',localDate);
      if(existing?.finalizedAt) return existing;
      const legacy=existing||await db.get('storyDays',localDate), snapshot=await buildSnapshot(localDate,legacy), now=getNow();
      let status=forceStatus||currentState(snapshot,localDate,now);
      if(source==='manual'&&status!=='ready_to_close') throw new Error('Parece que todavía queda un momento pendiente.');
      if(status==='ready_to_close')status='completed';
      if(!['completed','incomplete','no_goals'].includes(status))return null;
      const count=counts(snapshot), messageType=status==='completed'?'success':status==='incomplete'?'support':null;
      const legacyText=legacy?.motivationMessageText||legacy?.message||'', official=officialMessage(messageType,legacyText);
      const assigned=official?{motivationMessageId:official.id,motivationMessageText:official.text,motivationMessageType:messageType,motivationAssignedAt:legacy.motivationAssignedAt||now.toISOString()}:await assignMessage(messageType);
      const record={id:localDate,localDate,timezone:timezone(),timezoneOffset:getLocalCutoff(localDate).getTimezoneOffset(),cutoffAt:getLocalCutoff(localDate).toISOString(),finalizedAt:now.toISOString(),finalizationSource:source,status,scheduledHabitCount:count.scheduled,completedHabitCount:count.completed,incompleteHabitCount:count.incomplete,shortVersionCount:count.short,...snapshot,...assigned,celebrationSeen:existing?.celebrationSeen||false,createdAt:existing?.createdAt||legacy?.createdAt||now.toISOString(),updatedAt:now.toISOString()};
      await db.put('dailyHistory',record);document.dispatchEvent(new CustomEvent('spididay:day-finalized',{detail:record}));return record;
    })();
    try{return await finalizing}finally{finalizing=null}
  }
  async function recoverUnfinishedDays() {
    const [history,legacy,routines,completions,expenses]=await Promise.all([db.all('dailyHistory'),db.all('storyDays'),db.all('routines'),db.all('completions'),db.all('expenses')]);
    for (const record of history) {
      const messageType=record.status==='completed'?'success':record.status==='incomplete'?'support':null;
      if (record.finalizedAt && messageType && !officialMessage(messageType,record.motivationMessageText)) {
        Object.assign(record, await assignMessage(messageType), {updatedAt:getNow().toISOString()});
        await db.put('dailyHistory',record);
      } else if (record.finalizedAt && messageType) {
        const valid=officialMessage(messageType,record.motivationMessageText);
        if(valid&&(record.motivationMessageId!==valid.id||record.motivationMessageType!==messageType)){Object.assign(record,{motivationMessageId:valid.id,motivationMessageType:messageType,updatedAt:getNow().toISOString()});await db.put('dailyHistory',record)}
      }
    }
    const today=getLocalDate(), candidates=[...legacy.map(x=>x.localDate||x.date),...completions.map(x=>x.date),...expenses.map(x=>x.date),...routines.map(x=>x.createdAt&&getLocalDate(x.createdAt))].filter(Boolean).sort();
    if(!candidates.length)return;
    const cursor=localDateObject(candidates[0]), end=localDateObject(today), done=new Set(history.filter(x=>x.finalizedAt).map(x=>x.localDate));
    for(;cursor<end;cursor.setDate(cursor.getDate()+1)){const date=getLocalDate(cursor);if(!done.has(date))await finalizeDay(date,'recovered')}
  }
  async function evaluateClosures(show=true) {
    await recoverUnfinishedDays();const today=getLocalDate(), existing=await db.get('dailyHistory',today);
    if(!existing?.finalizedAt&&getNow()>=getLocalCutoff(today)){const record=await finalizeDay(today,'automatic');if(show&&record&&document.visibilityState==='visible')await showResult(record)}
    await renderTodayClosure();
  }
  async function assignMissingMessage(localDate){const record=await db.get('dailyHistory',localDate);if(!record)return null;const type=record.status==='completed'?'success':record.status==='incomplete'?'support':null;if(!type)return record;const valid=officialMessage(type,record.motivationMessageText);if(!valid)Object.assign(record,await assignMessage(type),{updatedAt:getNow().toISOString()});else Object.assign(record,{motivationMessageId:valid.id,motivationMessageText:valid.text,motivationMessageType:type});await db.put('dailyHistory',record);return record}
  function injectInterface() {
    const today=$('#view-hoy .home-section');if(today&&!$('#dailyClosure'))today.insertAdjacentHTML('afterbegin','<section id="dailyClosure" class="daily-closure" aria-live="polite"></section>');
    if(!$('#dayResultDialog'))document.body.insertAdjacentHTML('beforeend','<dialog id="dayResultDialog" class="day-result-dialog" aria-labelledby="dayResultLabel"><button type="button" class="round-btn result-close" data-result-close aria-label="Cerrar">×</button><div class="result-art" aria-hidden="true"><object data="./mascot-spidi-marea.svg" type="image/svg+xml"></object><i></i><i></i><i></i></div><p class="overline" id="dayResultLabel"></p><h2 id="dayResultMessage"></h2><p id="dayResultSecondary"></p><div id="dayResultPending"></div><div class="actions"><button type="button" class="primary" id="dayResultPrimary"></button><button type="button" class="secondary" id="dayResultView">Ver mi día</button></div><p id="dayResultSaved" role="status"></p></dialog>');
  }
  async function renderTodayClosure() {
    const root=$('#dailyClosure');if(!root)return;const today=getLocalDate(), record=await db.get('dailyHistory',today);
    if(record?.finalizedAt){root.innerHTML=`<article class="closed-day-card"><p class="overline">ESTE DÍA CUENTA</p><h2>${record.status==='completed'?'Tu día quedó guardado.':record.status==='incomplete'?'Hoy quedó guardado tal como fue.':'Hoy no tenías momentos programados.'}</h2><p class="closure-counts">${record.status==='no_goals'?'Tu historia también puede descansar.':`${record.completedHabitCount} completados · ${record.incompleteHabitCount} pendientes`}</p>${record.motivationMessageText?`<blockquote>“${esc(record.motivationMessageText)}”</blockquote>`:record.status!=='no_goals'?`<div class="missing-message"><p>Este día todavía no tiene un mensaje guardado.</p><button type="button" class="secondary" data-assign-official="${today}">Asignar mensaje</button></div>`:''}<button type="button" class="secondary history-link" data-open-history="${today}">Ver en Mi historia</button></article>`;return}
    const snapshot=await buildSnapshot(today), status=currentState(snapshot,today);root.innerHTML=status==='ready_to_close'?'<article class="ready-close-card"><p class="overline">Hoy cumpliste contigo.</p><h2>Todo está listo. Puedes guardar este día en tu historia.</h2><button type="button" class="primary" id="finishDayButton">Terminé mi día</button></article>':'';
  }
  async function showResult(record) {
    if(!record||record.status==='no_goals'||record.celebrationSeen)return;const dialog=$('#dayResultDialog');dialogOpener=document.activeElement;
    dialog.classList.toggle('support-result',record.status==='incomplete');$('#dayResultLabel').textContent=record.status==='completed'?'ESTE DÍA CUENTA':'MAÑANA SEGUIMOS';$('#dayResultMessage').textContent=record.motivationMessageText;$('#dayResultSecondary').textContent=record.status==='completed'?'Hoy cumpliste una promesa contigo.':'Este día también forma parte de tu historia.';
    $('#dayResultPending').innerHTML=record.status==='incomplete'?record.habitSnapshot.filter(h=>h.status!=='completed'||!h.completedBeforeCutoff).map(h=>`<span>${esc(h.name)}</span>`).join(''):'';$('#dayResultPrimary').textContent=record.status==='completed'?'Guardar este momento':'Mañana volvemos a intentarlo';$('#dayResultSaved').textContent='';dialog.showModal();
    record.celebrationSeen=true;record.updatedAt=getNow().toISOString();await db.put('dailyHistory',record);
  }
  function closeResult(){const dialog=$('#dayResultDialog');if(dialog.open)dialog.close();if(dialogOpener?.isConnected)dialogOpener.focus()}
  async function timeline() {
    const root=$('#storyTimeline');if(!root)return;const rows=(await db.all('dailyHistory')).filter(d=>d.finalizedAt).sort((a,b)=>b.localDate.localeCompare(a.localDate));
    root.innerHTML=rows.length?rows.map(d=>`<button type="button" class="story-day" data-story-date="${d.localDate}"><span class="story-day-date">${esc(dateText(d.localDate))}</span><strong>${d.status==='completed'?'Día completado':d.status==='incomplete'?'Un día que pidió descanso':'Día sin objetivos'}</strong><span>${d.completedHabitCount} de ${d.scheduledHabitCount} momentos cumplidos${d.incompleteHabitCount?` · ${d.incompleteHabitCount} pendientes`:''}</span><span>${money(d.totalSpent)} usados${d.reflectionSnapshot?' · Reflexión guardada':''}${d.verseSnapshot?' · Versículo guardado':''}</span>${d.motivationMessageText?`<q>${esc(d.motivationMessageText)}</q>`:d.status!=='no_goals'?'<span>Este día todavía no tiene un mensaje guardado.</span>':''}</button>`).join(''):'<div class="story-empty"><h2>Tu historia empieza hoy.</h2><p>Cuando cierres tus días, aparecerán aquí.</p></div>';
  }
  async function detail(date) {
    const d=await db.get('dailyHistory',date);if(!d)return;const root=$('#storyTimeline'), elapsed=Math.max(0,Math.floor((getLocalDayStart(getLocalDate())-getLocalDayStart(date))/86400000));
    const habits=d.habitSnapshot.map(h=>`<div class="story-habit-status"><span aria-hidden="true">${h.status==='completed'&&h.completedBeforeCutoff?'✓':h.status==='short_version'?'◐':'○'}</span><strong>${esc(h.name)}</strong><small>${h.status==='completed'&&h.completedBeforeCutoff?`Completado${h.completedAt?' a las '+timeText(h.completedAt):''}.`:h.status==='short_version'?'Realizaste una versión corta.':h.status==='skipped'?'Lo omitiste con intención.':'No se completó antes de las 10:00 p. m.'}</small></div>`).join('')||'<p>No había hábitos programados.</p>';
    const expenses=d.expenseSnapshot.map(e=>`<div class="story-expense"><span>${esc(e.category)}</span><strong>${money(e.amount)}</strong><small>${esc(e.description)}${e.time?' · '+timeText(e.time):''}</small></div>`).join('')||'<p>No registraste gastos este día.</p>';
    const verse=d.verseSnapshot, reflection=d.reflectionSnapshot?.text||d.reflectionSnapshot?.reflection||'';
    root.innerHTML=`<article class="story-detail"><button type="button" class="secondary" data-story-back>Volver a Mi historia</button><p class="overline">${elapsed?`Hace ${elapsed} días`:'Hoy'}</p><h2>${esc(dateText(date))}</h2><p>Así fue este día.</p><section><h3>Estado del día</h3><p>${d.status==='completed'?'Completado.':d.status==='incomplete'?'Incompleto.':'Sin objetivos.'}</p></section><section><h3>Mi ritmo</h3>${habits}</section><section><h3>Mi dinero</h3>${expenses}<b class="story-total">Total del día: ${money(d.totalSpent)}</b></section><section class="story-verse"><h3>Una palabra para ese día</h3>${verse&& (verse.text||verse.verseText)?`<blockquote>“${esc(verse.text||verse.verseText)}”<cite>${esc(verse.reference||'')}<br>${esc(verse.translation||'Reina-Valera 1909')}</cite></blockquote>`:'<p>Este día no tiene un versículo guardado.</p>'}</section>${reflection?`<section><h3>Lo que escribí</h3><p class="story-reflection">${esc(reflection)}</p></section>`:''}${d.motivationMessageText?`<section class="story-message-card"><p class="overline">El mensaje que me acompañó ese día</p><p>“${esc(d.motivationMessageText)}”</p></section>`:d.status!=='no_goals'?`<section class="story-message-card missing-message"><p>Este día todavía no tiene un mensaje guardado.</p><button type="button" class="secondary" data-assign-official="${date}">Asignar mensaje</button></section>`:''}</article>`;
  }
  async function completeLegacyMemory(date,status){await finalizeDay(date,'recovered',status);await detail(date)}
  async function renderPromises(){const root=$('#storyPromises');if(!root)return;const rows=await db.all('storyPromises');root.innerHTML=rows.map(p=>`<div class="story-promise"><span>${esc(p.text)}</span></div>`).join('')||'<p class="supporting">Aquí puedes guardar las promesas que eliges cuidar.</p>'}
  async function init() {
    injectInterface();$('#originPhoto')?.setAttribute('src','./assets/origin-spididay.png');if($('#originPhoto'))$('#originPhoto').hidden=false;$('#originPhotoEmpty')?.setAttribute('hidden','');
    await db.open();await evaluateClosures(false);await timeline();await renderPromises();
    const letter=await db.get('storyLetter','letter');if(letter&&$('#storyLetterText'))$('#storyLetterText').value=letter.text||'';
    $('#storyLetterText')?.addEventListener('input',e=>{clearTimeout(init.letterTimer);init.letterTimer=setTimeout(()=>db.put('storyLetter',{id:'letter',text:e.target.value,updatedAt:getNow().toISOString()}),350)});
    $('#storyPromiseForm')?.addEventListener('submit',async e=>{e.preventDefault();const input=e.currentTarget.elements.text,text=input.value.trim();if(!text)return;await db.put('storyPromises',{id:crypto.randomUUID?.()||String(Date.now()),text,createdAt:getNow().toISOString()});input.value='';await renderPromises()});
    document.addEventListener('click',async e=>{const finish=e.target.closest('#finishDayButton');if(finish){finish.disabled=true;finish.textContent='Guardando este momento…';try{const record=await finalizeDay(getLocalDate(),'manual');await renderTodayClosure();await timeline();await showResult(record)}catch(error){window.MareaApp?.toast(error.message);await renderTodayClosure()}return}const date=e.target.closest('[data-story-date]')?.dataset.storyDate;if(date)await detail(date);if(e.target.closest('[data-story-back]'))await timeline();const open=e.target.closest('[data-open-history]')?.dataset.openHistory;if(open){window.MareaApp?.nav?.('historia');document.querySelector('[data-view="historia"]')?.click();await detail(open)}if(e.target.closest('[data-result-close]'))closeResult();if(e.target.closest('#dayResultPrimary')){$('#dayResultSaved').textContent='Este momento ya forma parte de tu historia.';e.target.closest('#dayResultPrimary').textContent='✓ Guardado'}if(e.target.closest('#dayResultView')){closeResult();document.querySelector('[data-view="historia"]')?.click();await detail(getLocalDate())}});
    $('#dayResultDialog')?.addEventListener('cancel',e=>{e.preventDefault();closeResult()});
    document.addEventListener('click',async e=>{const button=e.target.closest('[data-assign-official]');if(!button)return;button.disabled=true;button.textContent='Asignando mensaje…';const record=await assignMissingMessage(button.dataset.assignOfficial);if(record){await renderTodayClosure();await timeline();await detail(record.localDate)}});
    document.addEventListener('click',e=>{if(e.target.closest('[data-view]'))evaluateClosures(true)});
    document.addEventListener('marea:data-refreshed',()=>{renderTodayClosure();evaluateClosures(false)});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')evaluateClosures(true)});window.addEventListener('focus',()=>evaluateClosures(true));
    setInterval(()=>evaluateClosures(true),60000);setTimeout(()=>evaluateClosures(true),Math.max(1000,getLocalCutoff(getLocalDate())-getNow()+100));
  }
  window.SpidiDayClosure={DAILY_CUTOFF_HOUR,DAILY_CUTOFF_MINUTE,getNow,setNowProvider,getLocalDate,getLocalDayStart,getLocalCutoff,currentState,buildSnapshot,finalizeDay,evaluateClosures,completeLegacyMemory,timeline,detail};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
