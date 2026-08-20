import{Q as y,T as M,aJ as j,_ as d,g as q,s as J,a as Q,b as Z,t as H,q as K,l as _,c as X,G as Y,L as ee,a4 as te,e as ae,A as re,I as ne}from"./mermaid.core-DhNWqatU.js";import{p as ie}from"./chunk-4BX2VUAB-CvLx8Nus.js";import{p as se}from"./treemap-KZPCXAKY-CpCfzTvy.js";import{d as O}from"./arc-Cuy1Jilv.js";import{o as le}from"./ordinal-BEUY7yj5.js";import"./index-odIDTkX1.js";import"./_baseUniq-m4bvHYLo.js";import"./_basePickBy-yKVB_O-T.js";import"./clone-BT44Rs5O.js";import"./init-DgMTbwtc.js";try{let e=typeof window<"u"?window:typeof global<"u"?global:typeof globalThis<"u"?globalThis:typeof self<"u"?self:{},a=new e.Error().stack;a&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[a]="ec0c060f-846e-46a0-9e89-4628c8b75c64",e._sentryDebugIdIdentifier="sentry-dbid-ec0c060f-846e-46a0-9e89-4628c8b75c64")}catch{}function oe(e,a){return a<e?-1:a>e?1:a>=e?0:NaN}function ce(e){return e}function ue(){var e=ce,a=oe,f=null,S=y(0),s=y(M),o=y(0);function l(t){var n,c=(t=j(t)).length,p,w,m=0,u=new Array(c),i=new Array(c),v=+S.apply(this,arguments),x=Math.min(M,Math.max(-M,s.apply(this,arguments)-v)),h,C=Math.min(Math.abs(x)/c,o.apply(this,arguments)),b=C*(x<0?-1:1),g;for(n=0;n<c;++n)(g=i[u[n]=n]=+e(t[n],n,t))>0&&(m+=g);for(a!=null?u.sort(function(A,D){return a(i[A],i[D])}):f!=null&&u.sort(function(A,D){return f(t[A],t[D])}),n=0,w=m?(x-c*b)/m:0;n<c;++n,v=h)p=u[n],g=i[p],h=v+(g>0?g*w:0)+b,i[p]={data:t[p],index:n,value:g,startAngle:v,endAngle:h,padAngle:C};return i}return l.value=function(t){return arguments.length?(e=typeof t=="function"?t:y(+t),l):e},l.sortValues=function(t){return arguments.length?(a=t,f=null,l):a},l.sort=function(t){return arguments.length?(f=t,a=null,l):f},l.startAngle=function(t){return arguments.length?(S=typeof t=="function"?t:y(+t),l):S},l.endAngle=function(t){return arguments.length?(s=typeof t=="function"?t:y(+t),l):s},l.padAngle=function(t){return arguments.length?(o=typeof t=="function"?t:y(+t),l):o},l}var de=ne.pie,z={sections:new Map,showData:!1},T=z.sections,F=z.showData,pe=structuredClone(de),ge=d(()=>structuredClone(pe),"getConfig"),fe=d(()=>{T=new Map,F=z.showData,re()},"clear"),he=d(({label:e,value:a})=>{if(a<0)throw new Error(`"${e}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);T.has(e)||(T.set(e,a),_.debug(`added new section: ${e}, with value: ${a}`))},"addSection"),me=d(()=>T,"getSections"),ve=d(e=>{F=e},"setShowData"),ye=d(()=>F,"getShowData"),P={getConfig:ge,clear:fe,setDiagramTitle:K,getDiagramTitle:H,setAccTitle:Z,getAccTitle:Q,setAccDescription:J,getAccDescription:q,addSection:he,getSections:me,setShowData:ve,getShowData:ye},Se=d((e,a)=>{ie(e,a),a.setShowData(e.showData),e.sections.map(a.addSection)},"populateDb"),we={parse:d(async e=>{const a=await se("pie",e);_.debug(a),Se(a,P)},"parse")},xe=d(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,"getStyles"),Ae=xe,De=d(e=>{const a=[...e.values()].reduce((s,o)=>s+o,0),f=[...e.entries()].map(([s,o])=>({label:s,value:o})).filter(s=>s.value/a*100>=1).sort((s,o)=>o.value-s.value);return ue().value(s=>s.value)(f)},"createPieArcs"),Ce=d((e,a,f,S)=>{_.debug(`rendering pie chart
`+e);const s=S.db,o=X(),l=Y(s.getConfig(),o.pie),t=40,n=18,c=4,p=450,w=p,m=ee(a),u=m.append("g");u.attr("transform","translate("+w/2+","+p/2+")");const{themeVariables:i}=o;let[v]=te(i.pieOuterStrokeWidth);v??=2;const x=l.textPosition,h=Math.min(w,p)/2-t,C=O().innerRadius(0).outerRadius(h),b=O().innerRadius(h*x).outerRadius(h*x);u.append("circle").attr("cx",0).attr("cy",0).attr("r",h+v/2).attr("class","pieOuterCircle");const g=s.getSections(),A=De(g),D=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12];let $=0;g.forEach(r=>{$+=r});const G=A.filter(r=>(r.data.value/$*100).toFixed(0)!=="0"),E=le(D);u.selectAll("mySlices").data(G).enter().append("path").attr("d",C).attr("fill",r=>E(r.data.label)).attr("class","pieCircle"),u.selectAll("mySlices").data(G).enter().append("text").text(r=>(r.data.value/$*100).toFixed(0)+"%").attr("transform",r=>"translate("+b.centroid(r)+")").style("text-anchor","middle").attr("class","slice"),u.append("text").text(s.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText");const N=[...g.entries()].map(([r,I])=>({label:r,value:I})),k=u.selectAll(".legend").data(N).enter().append("g").attr("class","legend").attr("transform",(r,I)=>{const L=n+c,B=L*N.length/2,V=12*n,U=I*L-B;return"translate("+V+","+U+")"});k.append("rect").attr("width",n).attr("height",n).style("fill",r=>E(r.label)).style("stroke",r=>E(r.label)),k.append("text").attr("x",n+c).attr("y",n-c).text(r=>s.getShowData()?`${r.label} [${r.value}]`:r.label);const R=Math.max(...k.selectAll("text").nodes().map(r=>r?.getBoundingClientRect().width??0)),W=w+t+n+c+R;m.attr("viewBox",`0 0 ${W} ${p}`),ae(m,p,W,l.useMaxWidth)},"draw"),be={draw:Ce},Ne={parser:we,db:P,renderer:be,styles:Ae};export{Ne as diagram};
//# sourceMappingURL=pieDiagram-SKSYHLDU-DkH_gjd3.js.map
