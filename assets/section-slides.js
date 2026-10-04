/* Slide section: exported slides whose shapes animate in, played with GSAP.
 *
 * Markup, per slide:
 *   <section class="animation-page" data-page>
 *     <div class="slide-stage"><svg class="slide-art" viewBox="0 0 W H" ...>  exported slide
 *     <div class="slide-controls"> with a [data-replay] button and, optionally, [data-pause]
 *   data-video-click="replay" on the section: clicking the video replays the slide.
 * Top-level <g data-shape> groups are the shapes. A shape animates when it has
 *   data-animate="effect start duration [option ...]"     start and duration in seconds
 *     effect: fade, wipe-left, wipe-right, or draw (its strokes draw themselves)
 *     options: scale=0.15   start scale
 *              x=-2.5 y=0   start offset, in slide units
 *              motion=y:0.538:0.525   PowerPoint motion path, as fractions of the slide
 *              ease=power2.out        any GSAP ease
 *              out=1.8:0.5            fade out again at 1.8 s, over 0.5 s
 * On svg.slide-art:
 *   data-crop="x y w h"           viewBox to show once the title moves into the page heading
 *   data-mobile-panels="name x y w h | name x y w h"
 *                                 phone layout: one stacked SVG per panel; a group picks
 *                                 its panel with data-panel="name" (default: the first).
 *                                 Without it, phones get one panel showing the crop.
 * The group marked data-slide-title (or else the first group) becomes the page heading, and
 * a group marked data-slide-subtitle becomes a line of text under it. data-slide-subtitle="0.4"
 * places that line so 40% of the free space between the heading and the slide's content
 * (its labels or media) is above it and 60% below.
 * A group holding a <video> becomes a video comparison: its <clipPath> rects are the
 * panels (label columns are as wide as their panels) and its other foreignObjects are
 * the panel labels, keeping their color, alignment, font, and weight. A <video loop> repeats;
 * without loop it plays once and holds its last frame.
 */
(() => {
  if (!window.gsap) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Reparent the original animated elements for narrow screens: no duplicate
  // IDs, duplicate media decoders, or flattened slide images.
  const narrow = matchMedia('(max-width: 760px), (max-width: 900px) and (orientation: portrait)');
  const box = value => value.trim().split(/[\s,]+/).map(Number);
  const layouts = [...document.querySelectorAll('.animation-page .slide-stage')].map(stage => {
    const source=stage.querySelector('.slide-art');
    const [, , slideWidth, slideHeight]=box(source.getAttribute('viewBox'));
    stage.closest('.animation-page').slideSize={width:slideWidth,height:slideHeight};
    const groups=[...source.children].filter(g=>g.dataset.shape);
    if(!groups.length)return null;
    const title=source.querySelector(':scope > [data-slide-title]') || groups[0];
    const mobile=document.createElement('div'); mobile.className='slide-mobile';
    const heading=document.createElement('h2');
    const titleLines=[...title.querySelectorAll('foreignObject > div > div')];
    titleLines.forEach((line,index)=>{
      if(index)heading.append(document.createTextNode(' '));
      for(const run of line.children){
        const span=document.createElement('span');span.textContent=run.textContent;
        // Preserve semantic color emphasis without carrying PPT font sizes.
        if(run.style.color)span.style.color=run.style.color;
        heading.append(span);
      }
    });
    if(!heading.textContent)heading.textContent=title.textContent;
    const subtitle=source.querySelector(':scope > [data-slide-subtitle]');
    if(subtitle){
      // Heading and subtitle form one block, so the page reserves room for both.
      const block=document.createElement('div');block.className='page-heading slide-heading';
      const line=document.createElement('p');line.className='slide-subtitle';line.textContent=subtitle.textContent.trim();
      if(subtitle.dataset.slideSubtitle)line.dataset.spaceAbove=subtitle.dataset.slideSubtitle;
      block.append(heading,line);stage.closest('[data-page]').prepend(block);subtitle.style.display='none';
    }else{heading.className='page-heading slide-heading';stage.closest('[data-page]').prepend(heading);}
    title.style.display='none';
    if(source.dataset.crop)source.setAttribute('viewBox',source.dataset.crop);
    const crop=box(source.getAttribute('viewBox'));
    const label=stage.closest('[data-page]').getAttribute('aria-label') || heading.textContent;
    const panels=new Map((source.dataset.mobilePanels || `slide ${crop.join(' ')}`).split('|').map(entry=>{
      const [name,...view]=entry.trim().split(/\s+/);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox',view.join(' ')); svg.setAttribute('role','img'); svg.setAttribute('aria-label',`${label}: ${name}`);
      svg.classList.add('mobile-art'); mobile.append(svg); return [name,svg];
    }));
    // Keep video in ordinary HTML: WebKit composites video outside SVG
    // foreignObject coordinates and ignores the surrounding SVG clip path.
    const video=source.querySelector('video');
    let media=null,mediaBlock=null;
    stage.classList.toggle('has-media',Boolean(video));
    if(video){
      const group=video.closest('.slide-art > [data-shape]');
      const frame=video.closest('foreignObject');
      const [fx,fy,fw,fh]=['x','y','width','height'].map(a=>Number(frame.getAttribute(a)));
      const cells=[...group.querySelectorAll('clipPath rect')].map(r=>['x','y','width','height'].map(a=>Number(r.getAttribute(a))));
      const labelTop=cells.length?(cells[0][1]-fy)/fh:0;
      media=document.createElement('div');media.className='slide-comparison';
      // Geometry comes from the exported shape, so CSS stays independent of any one slide.
      for(const [name,value] of Object.entries({
        '--media-left':`${(fx-crop[0])/crop[2]*100}%`,'--media-top':`${(fy-crop[1])/crop[3]*100}%`,
        '--media-width':`${fw/crop[2]*100}%`,'--media-height':`${fh/crop[3]*100}%`,'--media-aspect':`${fw}/${fh}`,
        '--media-label-height':`${labelTop*100}%`,'--media-columns':String(Math.max(1,cells.length)),
        '--media-template':cells.length?cells.map(c=>`${c[2]}fr`).join(' '):'1fr',
        '--media-gap':`${cells.length>1?(cells[1][0]-cells[0][0]-cells[0][2])/fw*100:0}%`,
        '--media-video-height':`${100/(1-labelTop)}%`,'--media-video-top':`${-labelTop/(1-labelTop)*100}%`,
      }))media.style.setProperty(name,value);
      const labels=document.createElement('div');labels.className='comparison-labels';
      for(const text of [...group.querySelectorAll('foreignObject')].filter(f=>f!==frame)){
        const span=document.createElement('span');span.textContent=text.textContent.trim();
        const styled=text.querySelector('[style]')?.style;
        for(const property of ['color','textAlign','fontFamily','fontWeight'])if(styled?.[property])span.style[property]=styled[property];
        labels.append(span);
      }
      const cropBox=document.createElement('div');cropBox.className='comparison-crop';
      video.removeAttribute('style');cropBox.append(video);
      cells.slice(0,-1).forEach(([x,,w])=>{const gap=document.createElement('span');gap.className='comparison-gutter';gap.style.left=`${(x+w-fx)/fw*100}%`;cropBox.append(gap);});
      media.append(labels,cropBox);stage.append(media);
      group.replaceChildren();
      if(group.dataset.animate){media.dataset.animate=group.dataset.animate;delete group.dataset.animate;}
      mediaBlock=document.createElement('div');mediaBlock.className='slide-media';mediaBlock.setAttribute('aria-label','Video comparison');mobile.append(mediaBlock);
    }
    stage.append(mobile);
    const first=panels.values().next().value;
    return {stage,source,groups,title,subtitle,mobile,panels,first,media,mediaBlock};
  }).filter(Boolean);
  function layoutSlides() {
    for(const l of layouts) {
      if(narrow.matches) {
        for(const group of l.groups) {
          if(group===l.title || group===l.subtitle || !group.childElementCount) continue;
          (l.panels.get(group.dataset.panel) || l.first).append(group);
        }
        l.panels.forEach(panel=>{panel.hidden=!panel.childElementCount;});
        if(l.media)l.mediaBlock.append(l.media);
      } else {
        l.groups.forEach(g=>l.source.append(g));
        if(l.media)l.stage.append(l.media);
      }
    }
    fitSlides();
  }
  // Shift a subtitle within the free space below the heading. A transform does not change layout,
  // so the heading block still reserves the subtitle's height and nothing else moves.
  function placeSubtitles() {
    for (const l of layouts) {
      const page=l.stage.closest('[data-page]');
      const line=page.querySelector(':scope > .slide-heading > .slide-subtitle[data-space-above]');
      if(!line)continue;
      line.style.transform='none';
      const title=line.previousElementSibling.getBoundingClientRect(), own=line.getBoundingClientRect();
      const content=(page.querySelector('.comparison-labels span') || l.media || l.stage).getBoundingClientRect();
      const free=content.top-title.bottom-own.height;
      if(free<=0)continue;
      const shift=Number(line.dataset.spaceAbove)*free-(own.top-title.bottom);
      line.style.transform=`translateY(${shift}px)`;
    }
  }
  document.addEventListener('paper-layout',()=>requestAnimationFrame(placeSubtitles));
  window.addEventListener('resize',()=>requestAnimationFrame(placeSubtitles));
  function fitSlides() {
    for (const l of layouts) {
      if (!narrow.matches) {
        l.stage.style.removeProperty('height');
        l.mobile.style.removeProperty('transform');
        l.mobile.style.removeProperty('width');
        continue;
      }
      const page=l.stage.closest('[data-page]');
      const css=getComputedStyle(page);
      const available=Math.max(1,page.clientHeight-parseFloat(css.paddingTop)-parseFloat(css.paddingBottom));
      if(l.media){
        const diagramSpace=Math.max(1,available-l.media.offsetHeight-18);
        l.panels.forEach(panel=>{panel.style.maxHeight=`${diagramSpace}px`;});
      }
      // Widen the layout by 1/scale before shrinking, so the scaled content still fills the page width.
      l.mobile.style.width='';
      let natural=l.mobile.offsetHeight,scale=Math.min(1,available/Math.max(1,natural));
      for(let i=0;i<3 && scale<1;i++){
        l.mobile.style.width=`${100/scale}%`;
        natural=l.mobile.offsetHeight;
        scale=Math.min(1,available/Math.max(1,natural));
      }
      if(scale<1)l.mobile.style.width=`${100/scale}%`;
      l.mobile.style.transform=`scale(${scale})`;
      l.stage.style.height=`${natural*scale}px`;
    }
    document.dispatchEvent(new Event('paper-layout'));
  }
  const sizeObserver=new ResizeObserver(fitSlides);
  layouts.forEach(l=>{sizeObserver.observe(l.stage.closest('[data-page]'));sizeObserver.observe(l.mobile);sizeObserver.observe(l.stage.closest('[data-page]').querySelector('.slide-controls'));});
  document.fonts.ready.then(fitSlides);
  layoutSlides();
  narrow.addEventListener('change',layoutSlides);
  const entries = new Map();
  let active = null;
  let mediaTarget = null;
  function parseAnimation(value) {
    const [effect,start,duration,...options]=value.trim().split(/\s+/);
    const spec={effect,start:Number(start),duration:Number(duration)};
    for (const option of options) {
      const [key,raw]=option.split('=');
      if (key==='motion') { const [axis,from,to]=raw.split(':'); spec.motion={axis,from:Number(from),to:Number(to)}; }
      else if (key==='out') { const [at,length]=raw.split(':'); spec.out={start:Number(at),duration:Number(length ?? 0.5)}; }
      else if (key==='x' || key==='y') (spec.offset ??= {})[key]=Number(raw);
      else if (key==='scale') spec.scale=Number(raw);
      else spec[key]=raw;
    }
    return spec;
  }
  for (const section of document.querySelectorAll('.animation-page')) {
    const timeline = gsap.timeline({paused:true});
    const animated = new Set();
    const size = section.slideSize || {width:1280,height:720};
    for (const target of section.querySelectorAll('[data-animate]')) {
      const effect = parseAnimation(target.dataset.animate);
      animated.add(target);
      const from = {opacity:0};
      const to = {opacity:1,duration:effect.duration,ease:effect.ease || 'none'};
      if (effect.effect==='draw') {
        for (const path of target.querySelectorAll('path')) {
          const length=path.getTotalLength();
          timeline.fromTo(path,{strokeDasharray:length,strokeDashoffset:length},{strokeDashoffset:0,duration:effect.duration,ease:effect.ease || 'none'},effect.start);
        }
      }
      if (effect.effect==='wipe-left' || effect.effect==='wipe-right') {
        from.clipPath = effect.effect==='wipe-right' ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
        to.clipPath = 'inset(0 0 0 0)';
      }
      if (effect.scale !== undefined) {
        from.scale = effect.scale;
        to.scale = 1;
        gsap.set(target,{transformOrigin:'50% 50%'});
      }
      if (effect.offset) {
        for (const axis of ['x','y']) if (effect.offset[axis]) { from[axis] = effect.offset[axis]; to[axis] = 0; }
      }
      if (effect.motion) {
        const m = effect.motion;
        from[m.axis] = (m.from-m.to)*(m.axis==='y'?size.height:size.width);
        to[m.axis] = 0;
      }
      timeline.fromTo(target,from,to,effect.start);
      if (effect.out) timeline.to(target,{opacity:0,duration:effect.out.duration,ease:'none'},effect.out.start);
    }
    // A comparison is one video with the panels side by side, so they stay in sync.
    const videos = [...section.querySelectorAll('video')];
    videos.forEach(video => { window.paperMedia.configure(video); video.preload='auto'; video.addEventListener('error',()=>{section.dataset.mediaError='true';}); });
    const pauseButton = section.querySelector('[data-pause]');
    const entry = {section,timeline,videos,animated,playing:false};
    entries.set([...document.querySelectorAll('[data-page]')].indexOf(section),entry);
    const start = (restartMedia=true) => {
      entry.playing=true;
      if(pauseButton)pauseButton.textContent='Pause';
      if (reduced.matches) timeline.progress(1).pause();
      else timeline.restart();
      videos.forEach(v=>{if(restartMedia)v.currentTime=0;if(!reduced.matches)window.paperMedia.play(v,()=>v.isConnected&&!document.hidden&&mediaTarget?.videos.includes(v)&&mediaTarget.playing);});
    };
    section.querySelector('[data-replay]')?.addEventListener('click',()=>start(true));
    if(section.dataset.videoClick==='replay')videos.forEach(video=>video.addEventListener('click',()=>start(true)));
    pauseButton?.addEventListener('click',()=>{
      entry.playing=!entry.playing;
      pauseButton.textContent=entry.playing?'Pause':'Play';
      if(entry.playing){timeline.resume();videos.forEach(v=>window.paperMedia.play(v,()=>v.isConnected&&!document.hidden&&mediaTarget?.videos.includes(v)&&mediaTarget.playing));}
      else{timeline.pause();videos.forEach(v=>v.pause());}
    });
    entry.start=start;
    if (reduced.matches) timeline.progress(1).pause();
  }
  // Start the destination's media on navigation intent, before the page moves.
  // Diagram timelines remain separate; arrival must not rewind an already playing video.
  window.preparePaperSlide = index => {
    const next=entries.get(index);
    if(mediaTarget===next) return;
    mediaTarget?.videos.forEach(video=>video.pause());
    mediaTarget=next;
    if(!next) return;
    next.playing=!reduced.matches;
    next.videos.forEach(video=>{
      video.currentTime=0;
      if(!reduced.matches) window.paperMedia.play(video,()=>video.isConnected&&!document.hidden&&mediaTarget===next&&next.playing);
    });
  };
  window.activatePaperSlide = index => {
    const next = entries.get(index);
    if (active===next) return;
    if(active) active.timeline.pause();
    active=next;
    if(active) active.start(false);
  };
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      mediaTarget?.videos.forEach(v=>v.pause());
      if(active)active.timeline.pause();
    }
  });
  document.addEventListener('paper-media-activation',()=>{
    if(document.hidden || reduced.matches)return;
    if(mediaTarget && (mediaTarget!==active || active.playing))mediaTarget.videos.forEach(v=>window.paperMedia.play(v,()=>v.isConnected&&!document.hidden&&mediaTarget?.videos.includes(v)&&mediaTarget.playing));
    if(active?.playing)active.timeline.resume();
  });
  reduced.addEventListener('change',()=>{if(reduced.matches)entries.forEach(e=>{e.timeline.progress(1).pause();e.videos.forEach(v=>v.pause());});});
})();
