const W = 720, H = 1280, CELL = 76, BOARD_Y = 180;
const FONT = '"Nunito", system-ui, sans-serif';
const DISPLAY_FONT = '"Baloo 2", "Nunito", system-ui, sans-serif';
const PALETTES = {
    classic: { top:'#eff8ff', bottom:'#dceeff', ink:'#283b69', muted:'#7180a0', panel:'#fffdf9', edge:'#d2e2f5', accent:'#68a9ed', dark:'#3979cb', gold:'#ffd14b', slot:'#f1f7ff' },
    vaporwave: { top:'#fff0f6', bottom:'#ffdfec', ink:'#66315f', muted:'#956e91', panel:'#fffafd', edge:'#f1d2e3', accent:'#ee78ab', dark:'#c54e81', gold:'#ffc95b', slot:'#fff3f8' },
    cyberpunk: { top:'#e9fff7', bottom:'#d3f8eb', ink:'#23545c', muted:'#62868a', panel:'#fffef8', edge:'#cfeae0', accent:'#48c1a2', dark:'#278c78', gold:'#ffd24f', slot:'#effbf5' }
};
const CLOUDS = [{x:42,y:165,s:.76,v:4},{x:520,y:365,s:.54,v:3},{x:170,y:940,s:.7,v:2},{x:570,y:1110,s:.58,v:3}];
function rr(c,x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
export const renderMethods = {
    palette(){return PALETTES[this.theme]||PALETTES.classic;},
    themeName(){return ({classic:'CANDY',vaporwave:'BERRY',cyberpunk:'MINT'})[this.theme]||'CANDY';},
    render(){const c=this.ctx;c.clearRect(0,0,W,H);this.buttonHits={};this.trayRects=[];c.save();if(this.shakeTimer>0){const s=this.shakeIntensity*this.shakeTimer/.35;c.translate((Math.random()-.5)*s,(Math.random()-.5)*s);}this.drawBackdrop();if(this.screen==='home')this.renderHome();else if(this.screen==='game')this.renderGame();else this.renderIslands();if(this.modal)this.renderModal();c.restore();},
    drawBackdrop(){
        const c=this.ctx,p=this.palette(),g=c.createLinearGradient(0,0,W,H);
        g.addColorStop(0,p.top);g.addColorStop(1,p.bottom);
        c.fillStyle=g;c.fillRect(0,0,W,H);
        if(this.screen!=='game'){
            for(const a of CLOUDS){
                const x=((a.x+this.clock*a.v)%(W+240))-120;
                c.globalAlpha=.34;c.fillStyle='#fff';c.beginPath();
                c.ellipse(x,a.y,44*a.s,15*a.s,0,0,Math.PI*2);
                c.ellipse(x+24*a.s,a.y-8*a.s,27*a.s,22*a.s,0,0,Math.PI*2);
                c.ellipse(x+53*a.s,a.y+1*a.s,34*a.s,14*a.s,0,0,Math.PI*2);
                c.fill();
            }
        }
        c.globalAlpha=1;
    },
    panel(r,fill=this.palette().panel,rad=26,shadow=true){const c=this.ctx,p=this.palette();c.save();if(shadow){c.shadowColor='rgba(40,70,90,.12)';c.shadowBlur=12;c.shadowOffsetY=4;}c.fillStyle=fill;rr(c,r.x,r.y,r.width,r.height,rad);c.fill();c.restore();c.strokeStyle=p.edge;c.lineWidth=2;rr(c,r.x+1,r.y+1,r.width-2,r.height-2,rad);c.stroke();},
    drawContain(img,x,y,w,h){if(!img)return;const s=Math.min(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;this.ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);},
    text(t,x,y,size,color=this.palette().ink,weight=700,align='center'){const c=this.ctx;c.save();c.textAlign=align;c.textBaseline='middle';c.font=`${weight} ${size}px ${FONT}`;c.fillStyle=color;c.fillText(t,x,y);c.restore();},
    title(t,x,y,size=56){const c=this.ctx,p=this.palette();c.save();c.textAlign='center';c.textBaseline='middle';c.font=`800 ${size}px ${DISPLAY_FONT}`;c.lineJoin='round';c.lineWidth=6;c.strokeStyle=p.panel;c.strokeText(t,x,y+2);c.fillStyle=p.ink;c.fillText(t,x,y);c.restore();},
    drawButton(name,r,label,color=this.palette().accent,kind='secondary',fontSize){const c=this.ctx,p=this.palette();this.buttonHits[name]=r;const rad=Math.min(22,r.height/2);c.save();c.shadowColor='rgba(39,68,80,.13)';c.shadowBlur=7;c.shadowOffsetY=kind==='primary'?5:3;c.fillStyle=kind==='primary'?p.dark:p.panel;rr(c,r.x,r.y+5,r.width,r.height,rad);c.fill();c.restore();c.fillStyle=kind==='primary'?color:p.panel;rr(c,r.x,r.y,r.width,r.height-4,rad);c.fill();if(kind!=='primary'){c.strokeStyle=p.edge;c.lineWidth=2;rr(c,r.x+1,r.y+1,r.width-2,r.height-6,rad-1);c.stroke();}else{c.globalAlpha=.16;c.fillStyle='#fff';rr(c,r.x+9,r.y+7,r.width-18,Math.min(12,r.height*.22),8);c.fill();c.globalAlpha=1;}this.text(label,r.x+r.width/2,r.y+(r.height-3)/2,fontSize||Math.min(27,r.height*.36),kind==='primary'?'#fff':p.ink,900);},
    drawPill(x,y,w,h,label,fill=this.palette().panel,color=this.palette().ink){const c=this.ctx;c.fillStyle=fill;rr(c,x,y,w,h,h/2);c.fill();c.strokeStyle=this.palette().edge;c.lineWidth=2;rr(c,x+1,y+1,w-2,h-2,h/2);c.stroke();this.text(label,x+w/2,y+h/2,Math.min(20,h*.42),color,800);},
    drawProgress(x,y,w,h,value){const c=this.ctx;c.fillStyle=`${this.palette().ink}18`;rr(c,x,y,w,h,h/2);c.fill();if(value>0){c.fillStyle=this.palette().accent;rr(c,x,y,Math.max(h,w*value),h,h/2);c.fill();}},
    drawStatus(y,fallback,force=false){const msg=!force&&this.statusTimer>0&&this.statusMessage?this.statusMessage:fallback;if(!msg)return;const c=this.ctx,p=this.palette();c.save();c.font=`700 19px ${FONT}`;const w=Math.min(650,c.measureText(msg).width+38);c.restore();const active=!force&&this.statusTimer>0&&this.statusMessage;if(active){c.fillStyle=p.ink;rr(c,W/2-w/2,y-21,w,42,18);c.fill();}this.text(msg,W/2,y,19,active?'#fff':p.muted,700);},
    renderHome(){const c=this.ctx,p=this.palette();this.text('A LITTLE WORLD OF TILES',360,72,15,p.muted,900);this.title('GRIDSHIFT',360,128,70);this.drawButton('sound_toggle',{x:458,y:48,width:96,height:44},this.muted?'SOUND OFF':'SOUND ON',p.panel,'secondary',11);this.drawButton('toggle_theme',{x:570,y:48,width:104,height:44},this.themeName(),p.panel,'secondary',15);this.text('PLACE  ·  CLEAR  ·  CELEBRATE',360,174,14,p.dark,800);
        const hero={x:48,y:205,width:624,height:335};this.panel(hero,p.panel,34,true);c.save();rr(c,hero.x+8,hero.y+8,hero.width-16,hero.height-16,29);c.clip();const g=c.createLinearGradient(hero.x,hero.y,hero.x,hero.y+hero.height);g.addColorStop(0,p.top);g.addColorStop(1,p.bottom);c.fillStyle=g;c.fillRect(hero.x+8,hero.y+8,hero.width-16,hero.height-16);this.drawContain(this.assets.island0,hero.x+90,hero.y+14+Math.sin(this.clock*1.15)*5,hero.width-180,270);c.restore();this.text('YOUR ISLAND',360,506,16,p.ink,900);this.drawProgress(280,518,160,8,Math.min(1,(this.islandLevels?.[0]||0)/5));
        this.text('CHOOSE YOUR WAY TO PLAY',360,592,15,p.muted,900);this.drawButton('start_classic',{x:58,y:622,width:604,height:78},'PLAY CLASSIC',p.accent,'primary',28);this.drawButton('start_fever',{x:58,y:718,width:294,height:68},'FEVER · 2 MIN','#f19a6e','secondary',20);this.drawButton('start_daily',{x:368,y:718,width:294,height:68},'DAILY CHALLENGE',p.gold,'secondary',19);
        this.panel({x:58,y:813,width:604,height:108},p.panel,25,false);this.drawContain(this.assets.island1,74,825,82,82);this.text('RESTORE THE ISLANDS',176,847,19,p.ink,900,'left');this.text('Spend crystals to restore each world.',176,877,16,p.muted,700,'left');this.drawButton('open_islands',{x:500,y:832,width:144,height:68},'EXPLORE',p.panel,'secondary',16);
        this.drawPill(74,957,245,50,`CLASSIC BEST  ${this.bestScores.classic||0}`);this.drawPill(401,957,245,50,`FEVER BEST  ${this.bestScores.fever||0}`);this.drawPill(220,1030,280,52,`✦  ${this.crystals} CRYSTALS`,p.panel,p.dark);},
    drawTile(x,y,size,color,alpha=1){const c=this.ctx,img=this.assets[`tile${color%6}`];c.save();c.globalAlpha=alpha;if(img){c.shadowColor='rgba(58,71,123,.16)';c.shadowBlur=Math.max(3,size*.08);c.shadowOffsetY=Math.max(2,size*.035);c.drawImage(img,x+size*.045,y+size*.025,size*.91,size*.91);c.shadowColor='transparent';c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=Math.max(1,size*.018);rr(c,x+size*.11,y+size*.08,size*.78,size*.78,size*.15);c.stroke();}else{c.fillStyle='#68a9ed';rr(c,x+3,y+3,size-6,size-6,size*.18);c.fill();}c.restore();},
    drawParticles(rect){if(!this.particles?.length)return;const c=this.ctx;c.save();if(rect){rr(c,rect.x,rect.y,rect.width,rect.height,15);c.clip();}for(const p of this.particles){const life=Math.max(0,1-p.age/p.life),r=p.radius*(.55+.45*life);c.globalAlpha=life;c.fillStyle=p.color;c.beginPath();c.moveTo(p.x,p.y-r*1.7);c.lineTo(p.x+r*.58,p.y);c.lineTo(p.x,p.y+r*1.7);c.lineTo(p.x-r*.58,p.y);c.closePath();c.fill();}c.restore();},
    renderGame(){const c=this.ctx,p=this.palette(),boardSize=CELL*8,boardX=(W-boardSize)/2,boardY=BOARD_Y,bottom=boardY+boardSize;this.cellSize=CELL;this.boardRect={x:boardX,y:boardY,width:boardSize,height:boardSize};
        this.panel({x:32,y:18,width:656,height:144},p.panel,28,true);this.text('SCORE',360,48,13,p.muted,900);this.title(String(this.model.score),360,82,48);const canUndo=this.model.history.length>0&&this.crystals>=2;this.drawButton('pause',{x:44,y:36,width:80,height:80},'Ⅱ',p.panel,'secondary',25);this.drawButton('undo_move',{x:596,y:36,width:80,height:80},'UNDO',p.panel,'secondary',14);if(!canUndo){c.fillStyle='rgba(90,110,108,.13)';rr(c,596,36,80,76,18);c.fill();}this.drawPill(140,123,190,28,`BEST  ${this.bestScores[this.mode]||0}`,p.panel,p.muted);const mode=this.mode==='fever'?`FEVER · ${Math.ceil(this.secondsLeft)}s`:this.mode==='daily'?'DAILY RUN':'CLASSIC';this.drawPill(390,123,190,28,mode,p.panel,this.mode==='fever'?'#c76a42':p.dark);
        const b=this.boardRect;this.panel({x:b.x-13,y:b.y-13,width:b.width+26,height:b.height+26},p.panel,29,true);c.fillStyle=p.slot;rr(c,b.x,b.y,b.width,b.height,15);c.fill();c.save();rr(c,b.x,b.y,b.width,b.height,15);c.clip();for(let y=0;y<8;y++)for(let x=0;x<8;x++){const px=b.x+x*CELL,py=b.y+y*CELL,val=this.model.board[y][x];if(val>=0){const anim=this.snapAnimations?.get(`${x},${y}`);if(anim){const progress=Math.max(0,Math.min(1,(anim.elapsed-anim.delay)/anim.duration)),t=progress-1,eased=1+2.70158*t*t*t+1.70158*t*t,ax=anim.fromX+(anim.targetX-anim.fromX)*eased,ay=anim.fromY+(anim.targetY-anim.fromY)*eased,size=CELL*(.82+.18*eased);this.drawTile(ax+(CELL-size)/2,ay+(CELL-size)/2,size,anim.color,.6+.4*progress);}else this.drawTile(px,py,CELL,val);}else{c.fillStyle=((x+y)&1)?'rgba(86,123,183,.05)':'rgba(86,123,183,.085)';rr(c,px+4,py+4,CELL-8,CELL-8,14);c.fill();c.strokeStyle='rgba(83,112,169,.075)';c.lineWidth=1;rr(c,px+4,py+4,CELL-8,CELL-8,14);c.stroke();}}c.restore();
        const drag=this.dragIndex>=0?this.dragLayout():null;let dragHint='';if(drag?.overlapsBoard)dragHint=this.drawPlacementPreview(drag,b);
        this.drawParticles(b);
        this.drawStatus(bottom+40,dragHint||'Drag pieces onto the board. Clear lines to make space.',Boolean(dragHint));
        const trayY=860;this.panel({x:30,y:trayY,width:660,height:360},p.panel,28,true);this.text('NEXT PIECES',360,trayY+30,14,p.muted,900);for(let i=0;i<3;i++){const r={x:43+i*212,y:trayY+54,width:202,height:276};this.trayRects.push(r);c.fillStyle=p.slot;rr(c,r.x,r.y,r.width,r.height,20);c.fill();const piece=this.model.tray[i];if(!piece||piece.used){c.globalAlpha=.55;this.text('USED',r.x+r.width/2,r.y+r.height/2,14,p.muted,900);c.globalAlpha=1;continue;}const cols=Math.max(...piece.cells.map(a=>a.x))+1,rows=Math.max(...piece.cells.map(a=>a.y))+1,size=Math.min(50,170/cols,218/rows),ox=r.x+(r.width-cols*size)/2,oy=r.y+24+(218-rows*size)/2;c.save();c.globalAlpha=this.dragIndex===i?.28:1;piece.cells.forEach(a=>this.drawTile(ox+a.x*size,oy+a.y*size,size,piece.color));if(piece.special){const icon=this.assets[`special${piece.special}`];if(icon)c.drawImage(icon,r.x+r.width-42,r.y+7,34,34);}c.restore();}
        this.drawPraise();if(drag&&!drag.overlapsBoard){c.save();c.globalAlpha=.94;drag.piece.cells.forEach(a=>this.drawTile(drag.left+a.x*drag.size,drag.top+a.y*drag.size,drag.size,drag.piece.color));c.restore();}},
    drawPlacementPreview(drag,b){
        const c=this.ctx,p=this.palette(),cells=drag.piece.cells,o=drag.origin,fit=this.model.canPlace(cells,o),pulse=.5+.5*Math.sin(this.clock*8);
        if(!fit){
            const off=cells.some(a=>{const x=o.x+a.x,y=o.y+a.y;return x<0||x>7||y<0||y>7;});
            for(const a of cells){
                const gx=o.x+a.x,gy=o.y+a.y;
                if(gx<0||gx>7||gy<0||gy>7)continue;
                const px=b.x+gx*CELL,py=b.y+gy*CELL;
                c.save();rr(c,px+4,py+4,CELL-8,CELL-8,14);c.clip();
                c.fillStyle='rgba(219,91,83,.24)';c.fillRect(px,py,CELL,CELL);
                c.strokeStyle='rgba(217,107,95,.5)';c.lineWidth=3;
                for(let k=-CELL;k<CELL;k+=16){c.beginPath();c.moveTo(px+k,py+CELL);c.lineTo(px+k+CELL,py);c.stroke();}
                c.restore();
                c.save();c.setLineDash([9,7]);c.strokeStyle='#d96b5f';c.lineWidth=3;rr(c,px+4,py+4,CELL-8,CELL-8,14);c.stroke();c.restore();
            }
            return off?'Part of that piece is off the board.':'No room there. Pieces cannot overlap.';
        }
        const placed=new Set(cells.map(a=>`${o.x+a.x},${o.y+a.y}`)),clearing=new Set();let lines=0;
        for(let i=0;i<8;i++){
            let row=true,col=true;
            for(let j=0;j<8;j++){
                if(this.model.board[i][j]<0&&!placed.has(`${j},${i}`))row=false;
                if(this.model.board[j][i]<0&&!placed.has(`${i},${j}`))col=false;
            }
            if(row){lines++;for(let x=0;x<8;x++)clearing.add(`${x},${i}`);}
            if(col){lines++;for(let y=0;y<8;y++)clearing.add(`${i},${y}`);}
        }
        for(const key of clearing){const[gx,gy]=key.split(',').map(Number);c.save();c.globalAlpha=.3+.2*pulse;c.fillStyle=p.gold;rr(c,b.x+gx*CELL+3,b.y+gy*CELL+3,CELL-6,CELL-6,15);c.fill();c.restore();}
        for(const a of cells){const px=b.x+(o.x+a.x)*CELL,py=b.y+(o.y+a.y)*CELL;this.drawTile(px,py,CELL,drag.piece.color,.78+.14*pulse);c.save();c.strokeStyle=p.dark;c.lineWidth=3;rr(c,px+4,py+4,CELL-8,CELL-8,14);c.stroke();c.restore();}
        for(const key of clearing){const[gx,gy]=key.split(',').map(Number),cx=b.x+(gx+.5)*CELL,cy=b.y+(gy+.5)*CELL,r=11;c.save();c.globalAlpha=.6+.4*pulse;c.fillStyle='#fff';c.strokeStyle=p.dark;c.lineWidth=2;c.beginPath();c.moveTo(cx,cy-r);c.lineTo(cx+r*.6,cy);c.lineTo(cx,cy+r);c.lineTo(cx-r*.6,cy);c.closePath();c.fill();c.stroke();c.restore();}
        return lines>0?`Clears ${lines} line${lines===1?'':'s'}.`:'Release to place it.';
    },
    showPraise(lines,combo){this.praise={text:combo>=3?`COMBO ×${combo}`:lines>=4?'INCREDIBLE':lines===3?'AMAZING':lines===2?'NICE CLEAR':'GOOD MOVE',start:this.clock};},
    drawPraise(){if(!this.praise)return;const age=this.clock-this.praise.start,life=1.1;if(age>=life){this.praise=null;return;}const scale=age<.2?.84+age*1.4:1.12-Math.max(0,age-.2)*.12,alpha=age>.78?1-(age-.78)/(life-.78):1,c=this.ctx;c.save();c.globalAlpha=alpha;c.translate(360,this.boardRect.y+215-age*22);c.scale(scale,scale);c.font=`800 38px ${DISPLAY_FONT}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=this.palette().ink;c.shadowColor='#fff';c.shadowBlur=14;c.fillText(this.praise.text,0,0);c.restore();},
    renderIslands(){const p=this.palette();this.title('RESTORE THE ISLANDS',360,82,45);this.text('Use crystals to bring each world back to life.',360,131,17,p.muted,700);this.drawPill(254,158,212,42,`✦  ${this.crystals} CRYSTALS`,p.panel,p.dark);const names=['Sky Haven','Prismatic Falls','Cloud City'],perks=[n=>`+${n} crystal${n===1?'':'s'} per run`,n=>`+${n*150} starting score`,n=>'5% crystal bonus per stage'];for(let i=0;i<3;i++){const x=30,y=228+i*238,w=660,h=214;this.panel({x,y,width:w,height:h},p.panel,25,true);const ix=x+15,iy=y+14,iw=185,ih=184,c=this.ctx;c.save();rr(c,ix,iy,iw,ih,19);c.clip();const bg=c.createLinearGradient(ix,iy,ix,iy+ih);bg.addColorStop(0,p.top);bg.addColorStop(1,p.bottom);c.fillStyle=bg;c.fillRect(ix,iy,iw,ih);this.drawContain(this.assets[`island${i}`],ix+8,iy+7,iw-16,ih-14);c.restore();const level=Math.max(0,Math.min(5,Number(this.islandLevels[i])||0));this.text(names[i],x+222,y+38,25,p.ink,900,'left');this.text(`RESTORED  ${level} / 5`,x+222,y+75,14,p.muted,900,'left');this.drawProgress(x+222,y+92,205,8,level/5);this.text(`PERK  ${perks[i](level)}`,x+222,y+125,16,p.dark,800,'left');this.text(level>=5?'Fully restored':`Next stage · ${this.islandCost(level)} crystals`,x+222,y+157,15,p.muted,700,'left');this.drawButton(`restore_${i}`,{x:x+468,y:y+139,width:169,height:55},level>=5?'COMPLETE':'RESTORE',level>=5?p.edge:p.accent,level>=5?'secondary':'primary',16);}this.drawButton('islands_home',{x:248,y:974,width:224,height:62},'BACK TO HOME',p.panel,'secondary',18);this.drawButton('toggle_theme',{x:516,y:1081,width:155,height:47},`THEME · ${this.themeName()}`,p.panel,'secondary',12);this.drawStatus(1150,'');},
    renderModal(){const c=this.ctx,p=this.palette();c.fillStyle='rgba(41,51,91,.40)';c.fillRect(0,0,W,H);const r={x:72,y:372,width:576,height:500};this.panel(r,p.panel,36,true);this.title(this.modal==='paused'?'TAKE A BREATHER':'RUN COMPLETE',360,r.y+82,42);if(this.modal==='results'){this.text('FINAL SCORE',360,r.y+157,15,p.muted,900);this.title(String(this.model.score),360,r.y+211,54);this.drawPill(190,r.y+246,340,46,`✦  ${this.crystalsEarned} CRYSTALS EARNED`,p.slot,p.dark);this.drawButton('modal_restart',{x:126,y:r.y+326,width:468,height:68},'PLAY AGAIN',p.accent,'primary',22);this.drawButton('modal_home',{x:126,y:r.y+411,width:468,height:60},'HOME',p.panel,'secondary',20);}else{this.text('Your island will be right here.',360,r.y+153,19,p.muted,700);this.drawButton('modal_resume',{x:126,y:r.y+207,width:468,height:68},'KEEP PLAYING',p.accent,'primary',22);this.drawButton('modal_restart',{x:126,y:r.y+295,width:468,height:60},'START OVER',p.panel,'secondary',20);this.drawButton('modal_home',{x:126,y:r.y+373,width:468,height:60},'HOME',p.panel,'secondary',20);}}
};
