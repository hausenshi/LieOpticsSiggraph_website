/* Derivation section: equations shown one step at a time, sliding between steps.
 *
 * Markup: <section class="formulation-page" data-page> with
 *   <template data-story-equation data-title="..." data-hold="5">   one per step, MathML inside.
 *       data-hold: seconds before autoplay moves on; data-tall: give this step extra height.
 *   .formulation-cards > .formulation-card                           optional; shown on the last
 *       step, and on phones each card gets its own step (its data-hold applies). Without
 *       cards, every template is an ordinary step.
 *   .formula-temporal (optional)                                     a figure kept across steps;
 *       its [data-steps="0,1"] elements are visible only on the listed steps, and
 *       data-step-anim="select 0 0.3, flash 0.3 0.3" animates one as its step begins
 *       (select: settles onto its target as it appears; flash: blinks once; out: fades away). Placed outside
 *       .formulation-viewport, it stays still while the steps slide, centered between the
 *       heading and the equations.
 *   [data-step-title] inside .formulation-heading (optional): the heading stays fixed and each
 *       step's data-title goes into this element instead.
 */
(()=>{
  const page=document.querySelector('.formulation-page');if(!page)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),content=page.querySelector('.formulation-content'),viewport=page.querySelector('.formulation-viewport');
  const title=page.querySelector('h2'),heading=page.querySelector('.formulation-heading'),cardsElement=page.querySelector('.formulation-cards');
  const stepTitle=heading.querySelector('[data-step-title]');
  const storyTemplates=[...page.querySelectorAll('[data-story-equation]')];
  const mobileForms=matchMedia('(max-width:760px)');
  const cards=[...page.querySelectorAll('.formulation-card')].map(el=>({el}));
  const hasCards=cards.length>0;
  // The step that shows the cards; without cards no step does.
  const formsChapter=hasCards?storyTemplates.length-1:storyTemplates.length;
  const hold=(el,fallback)=>Number(el?.dataset.hold)||fallback;
  const chapterCount=()=>hasCards?formsChapter+(mobileForms.matches?cards.length:1):storyTemplates.length;
  const chapterTimes=()=>{
    const holds=[...storyTemplates.slice(0,formsChapter).map(t=>hold(t,5)),...(hasCards&&mobileForms.matches?cards.map(c=>hold(c.el,6)):[])].slice(0,chapterCount()-1);
    return holds.reduce((times,h)=>[...times,times[times.length-1]+h],[0]);
  };
  const pauseButton=page.querySelector('[data-formula-pause]');
  let master=null,chapter=0,entryChapter=0,manualEntry=false,active=false,paused=false,resizeTimer;
  const effects=new Map();
  function stage(element){const source=document.createElement('div');source.className='formula-source';element.append(source);return {element,source,index:0};}
  const story=stage(page.querySelector('.formula-story'));
  const temporal=page.querySelector('.formula-temporal');
  const stepped=temporal?[...temporal.querySelectorAll('[data-steps]')].map(el=>({el,steps:el.dataset.steps.split(',').map(Number)})):[];
  function updateTemporal(index,animate=false){
    if(!temporal)return;
    temporal.hidden=index>=formsChapter;
    cancelEffect(temporal);
    stepped.forEach(({el,steps})=>gsap.set(el,{opacity:steps.includes(index)?1:0,scale:1,transformOrigin:'50% 50%'}));
    if(!animate||reduced.matches)return;
    const tween=gsap.timeline();
    for(const {el,steps} of stepped){
      if(!steps.includes(index)||!el.dataset.stepAnim)continue;
      const parts=el.dataset.stepAnim.split(',').map(part=>part.trim().split(/\s+/));
      if(parts.some(([kind])=>kind==='select'))gsap.set(el,{opacity:0});
      for(const [kind,at,length] of parts){
        const start=Number(at),duration=Number(length);
        if(kind==='select')tween.fromTo(el,{opacity:0,scale:1.12},{opacity:1,scale:1,duration,ease:'power2.out'},start);
        if(kind==='flash')tween.to(el,{opacity:.15,duration:duration/2,ease:'none'},start).to(el,{opacity:1,duration:duration/2,ease:'none'},start+duration/2);
        if(kind==='out')tween.to(el,{opacity:0,duration,ease:'power1.inOut'},start);
      }
    }
    effects.set(temporal,tween);
  }
  function cancelEffect(box){effects.get(box)?.kill();effects.delete(box);box.querySelectorAll('.formula-ghost').forEach(el=>el.remove());const source=box.querySelector(':scope>.formula-source');if(source)source.style.opacity='1';if(box===heading)gsap.set(title,{clearProps:'opacity,transform'});}
  // Chrome ignores MathML's columnalign, so pad table cells with <mspace> to honor it
  // (LaTeX's align: right | = | left).
  const MATHNS='http://www.w3.org/1998/Math/MathML';
  function alignTables(root){
    root.querySelectorAll('mspace[data-align-pad]').forEach(el=>el.remove());
    for(const table of root.querySelectorAll('mtable')){
      const aligns=(table.getAttribute('columnalign')||'center').trim().split(/\s+/);
      const rows=[...table.children].filter(r=>r.localName==='mtr').map(r=>[...r.children].filter(c=>c.localName==='mtd'));
      const probe=document.createElementNS(MATHNS,'mspace');probe.setAttribute('width','10em');
      const host=rows[0]?.[0];if(!host)continue;host.append(probe);
      const em=probe.getBoundingClientRect().width/10;probe.remove();if(!em)continue;
      const width=cell=>{const kids=[...cell.children];if(!kids.length)return 0;const r=kids.map(k=>k.getBoundingClientRect());return Math.max(...r.map(x=>x.right))-Math.min(...r.map(x=>x.left));};
      const widths=rows.map(r=>r.map(width));
      const columns=Math.max(...rows.map(r=>r.length));
      // Every cell is padded to its column's width, so the browser's own placement no longer matters.
      const pad=width=>{const el=document.createElementNS(MATHNS,'mspace');el.dataset.alignPad='';el.setAttribute('width',`${width/em}em`);return el;};
      for(let c=0;c<columns;c++){
        const align=aligns[Math.min(c,aligns.length-1)];
        const max=Math.max(...widths.map(w=>w[c]||0));
        rows.forEach((r,i)=>{
          const cell=r[c],gap=max-(widths[i][c]||0);if(!cell||gap<0.5)return;
          if(align==='right')cell.prepend(pad(gap));
          else if(align==='left')cell.append(pad(gap));
          else{cell.prepend(pad(gap/2));cell.append(pad(gap/2));}
        });
      }
    }
  }
  function sizeEquation(s){const math=s.source.querySelector('math');if(!math)return;math.style.transform='none';const scale=s.element.getBoundingClientRect().width/s.element.clientWidth||1;const natural=math.getBoundingClientRect().width/scale;math.style.transform=`scale(${Math.min(1,(s.element.clientWidth-12)/Math.max(1,natural))})`;}
  function equation(s,template,animate){
    cancelEffect(s.element);
    const previous=s.source.children.length?s.source.cloneNode(true):null;
    s.source.replaceChildren(template.content.cloneNode(true));alignTables(s.source);sizeEquation(s);
    if(!animate||reduced.matches)return;
    if(previous){previous.classList.add('formula-ghost');previous.setAttribute('aria-hidden','true');s.element.append(previous);}
    const tween=gsap.timeline({onComplete:()=>{previous?.remove();s.source.style.opacity='1';effects.delete(s.element);}});effects.set(s.element,tween);
    if(previous)tween.to(previous,{opacity:0,duration:.22,ease:'power1.inOut'},0);
    tween.fromTo(s.source,{opacity:0},{opacity:1,duration:.32,ease:'power1.inOut'},previous?.12:0);
  }
  function fit(){
    content.style.transform='none';
    const css=getComputedStyle(page);
    const figureOutside=temporal&&!content.contains(temporal)&&!temporal.hidden;
    if(figureOutside)temporal.style.transform='none';
    const reserved=figureOutside?temporal.offsetHeight+(parseFloat(css.rowGap)||0):0;
    const available=Math.max(1,page.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom)-reserved);
    // The final chapter uses actual smaller type/diagram dimensions, never a
    // transform on the chapter. Resolve its responsive sizing before sliding in.
    content.style.setProperty('--forms-unit','1');
    function fitDerivations(){
      content.querySelectorAll('.formula-full-derivation').forEach(box=>{
        const math=box.querySelector('math');math.style.transform='none';math.style.removeProperty('font-size');box.style.height='auto';
        if(!box.clientWidth)return;
        const width=math.getBoundingClientRect().width;
        if(width>box.clientWidth-4)math.style.fontSize=parseFloat(getComputedStyle(math).fontSize)*(box.clientWidth-4)/width+'px';
        box.style.height=math.getBoundingClientRect().height+'px';
      });
    }
    fitDerivations();
    if(chapter>=formsChapter){
      let unit=1;
      for(let i=0;i<3&&content.offsetHeight>available;i++){
        unit*=available/content.offsetHeight;
        content.style.setProperty('--forms-unit',String(unit));fitDerivations();
      }
      viewport.style.height=content.offsetHeight+'px';
    }else{
      const scale=Math.min(1,available/Math.max(1,content.offsetHeight));content.style.transform=`scale(${scale})`;viewport.style.height=content.offsetHeight*scale+'px';
    }
    alignTables(story.source);sizeEquation(story);
    // A fixed figure sits midway between the heading and the first line of the equations.
    if(figureOutside){
      const above=temporal.getBoundingClientRect().top-heading.getBoundingClientRect().bottom;
      const below=story.element.getBoundingClientRect().top-temporal.getBoundingClientRect().bottom;
      temporal.style.transform=`translateY(${(below-above)/2}px)`;
    }
  }
  let chapterTransition=null,outgoing=null;
  function finishChapterTransition(){
    chapterTransition?.kill();chapterTransition=null;outgoing?.remove();outgoing=null;
    page.style.setProperty('--chapter-shift','0px');
  }
  function snapshotChapter(){
    const layer=document.createElement('div');layer.className='formula-chapter-outgoing';layer.setAttribute('aria-hidden','true');layer.inert=true;
    const bounds=page.getBoundingClientRect();
    for(const element of stepTitle?[viewport]:[heading,viewport]){
      const rect=element.getBoundingClientRect(),copy=element.cloneNode(true);
      // Freeze the outgoing chapter before its parent's chapter class changes.
      // Otherwise the final chapter's smaller fonts and heights restyle the preceding chapter mid-slide.
      const properties=['display','position','top','right','bottom','left','width','height','min-width','max-width','min-height','max-height','font-size','font-family','font-weight','font-style','line-height','letter-spacing','margin','padding','gap','row-gap','column-gap','grid-template-columns','grid-column','grid-row','align-items','align-self','justify-content','flex','order','transform','transform-origin','overflow','box-sizing'];
      const originals=[element,...element.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
      originals.forEach((original,i)=>{const css=getComputedStyle(original);for(const property of properties)copies[i].style.setProperty(property,css.getPropertyValue(property));});
      copy.style.cssText=`position:absolute;left:${rect.left-bounds.left}px;top:${rect.top-bounds.top}px;width:${rect.width}px;height:${rect.height}px;min-height:0;transform:none;margin:0;`;
      if(element===heading){const h=copy.querySelector('h2');h.style.font=getComputedStyle(title).font;h.style.margin='0';}
      for(const el of [copy,...copy.querySelectorAll('[id]')])el.removeAttribute('id');
      // Only cloned gradients need new IDs; leave the live diagrams untouched.
      const ids=new Map();
      element.querySelectorAll('linearGradient[id]').forEach((el,i)=>{const id='outgoing-gradient-'+i;ids.set(el.id,id);copy.querySelectorAll('linearGradient')[i]?.setAttribute('id',id);});
      copy.querySelectorAll('[fill]').forEach(el=>{for(const [from,to] of ids)if(el.getAttribute('fill')===`url(#${from})`)el.setAttribute('fill',`url(#${to})`);});
      layer.append(copy);
    }
    page.append(layer);return layer;
  }
  function setChapter(index,animate=true){
    const previous=chapter,direction=Math.sign(index-previous)||1;
    finishChapterTransition();
    const slide=animate&&!reduced.matches&&index!==previous;
    if(slide)outgoing=snapshotChapter();
    chapter=Math.max(0,Math.min(index,chapterCount()-1));index=chapter;const template=storyTemplates[Math.min(index,formsChapter)];
    cancelEffect(heading);
    if(!stepTitle)title.textContent=template.dataset.title;
    else if(stepTitle.textContent!==template.dataset.title){
      stepTitle.textContent=template.dataset.title;
      if(slide)gsap.fromTo(stepTitle,{opacity:0},{opacity:1,duration:.4,ease:'power1.inOut'});
    }
    if(cardsElement)cardsElement.hidden=index<formsChapter;page.classList.toggle('show-formulations',index>=formsChapter);
    page.classList.toggle('single-form',mobileForms.matches&&index>=formsChapter);
    cards.forEach((card,i)=>{card.el.hidden=mobileForms.matches&&index>=formsChapter&&i!==index-formsChapter;});page.classList.toggle('tall-step','tall' in template.dataset);
    updateTemporal(index,animate);
    window.alignPaperHeadings?.();equation(story,template,false);fit();
    page.querySelectorAll('[data-formula-chapter]').forEach(b=>b.setAttribute('aria-current',Number(b.dataset.formulaChapter)===index?'step':'false'));
    if(slide){
      const distance=page.clientWidth;
      chapterTransition=gsap.timeline({onComplete:finishChapterTransition});
      chapterTransition.fromTo(page,{'--chapter-shift':`${direction*distance}px`},{'--chapter-shift':'0px',duration:.65,ease:'power2.inOut'},0)
        .to(outgoing,{x:-direction*distance,duration:.65,ease:'power2.inOut'},0);
    }
  }
  function pause(){paused=true;master?.pause();effects.forEach(e=>e.pause());pauseButton.textContent='Play';}
  function start(from=0){
    finishChapterTransition();master?.kill();[...effects.keys()].forEach(cancelEffect);paused=false;pauseButton.textContent='Pause';setChapter(reduced.matches?formsChapter:from,!reduced.matches);
    if(reduced.matches||!window.gsap){pauseButton.textContent='Pause';return;}
    master=gsap.timeline({onComplete:()=>{pauseButton.textContent='Pause';}});
    const times=chapterTimes();
    times.forEach((time,i)=>{if(i>from)master.call(()=>setChapter(i),[],time-times[from]);});
    master.to({}, {duration:2},'>');
  }

  function renderChapterButtons(){
    const nav=page.querySelector('.formula-chapters');
    const names=[...storyTemplates.slice(0,formsChapter).map(t=>t.dataset.title),...(!hasCards?[]:mobileForms.matches?cards.map(c=>c.el.querySelector('h3')?.textContent||''):[storyTemplates[formsChapter].dataset.title])];
    nav.replaceChildren(...names.map((name,i)=>{
      const button=document.createElement('button');button.type='button';button.dataset.formulaChapter=String(i);
      button.setAttribute('aria-label',`Derivation step ${i+1}: ${name}`);
      const number=document.createElement('span');number.textContent=String(i+1).padStart(2,'0');button.append(number);
      button.onclick=()=>{pause();setChapter(i);};return button;
    }));
  }
  renderChapterButtons();
  mobileForms.addEventListener('change',()=>{pause();renderChapterButtons();chapter=Math.min(chapter,chapterCount()-1);entryChapter=Math.min(entryChapter,chapterCount()-1);setChapter(chapter,false);});
  page.querySelector('[data-formula-replay]').onclick=()=>start(0);
  pauseButton.onclick=()=>{if(!master||master.progress()===1){start();return;}if(paused){paused=false;master.play();effects.forEach(e=>e.play());pauseButton.textContent='Pause';}else pause();};
  window.formulationNavigation={
    pause,
    canStep:direction=>chapter+direction>=0&&chapter+direction<chapterCount(),
    step(direction){if(!this.canStep(direction))return false;pause();setChapter(chapter+direction);entryChapter=chapter;if(!active)manualEntry=true;return true;},
    prepare:direction=>{if(!active){entryChapter=direction<0?chapterCount()-1:0;manualEntry=false;setChapter(entryChapter,false);}}
  };
  setChapter(0,false);
  new IntersectionObserver(entries=>{const visible=entries[0].isIntersecting;if(visible&&!active){active=true;if(!manualEntry)start(entryChapter);manualEntry=false;}else if(!visible&&active){active=false;pause();}},{threshold:.5}).observe(page);
  new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{finishChapterTransition();[...effects.keys()].forEach(cancelEffect);updateTemporal(chapter);fit();},120);}).observe(page);
  document.fonts.ready.then(fit);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  reduced.addEventListener('change',()=>{if(reduced.matches){master?.kill();setChapter(formsChapter,false);}});
})();
