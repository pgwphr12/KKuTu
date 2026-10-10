(function(){
 'use strict';
 document.addEventListener('DOMContentLoaded',function(){
  if(!window.jQuery)return;
  var $=jQuery,catalog=[{id:'kma-popular',name:'한국대중음악상'}];
  L.modeKAW='아무거나 잇기';L.server_1='연동서버';
  ['room-mode','quick-mode'].forEach(function(id){var select=document.getElementById(id);if(!select)return;$(select).empty();['KSH','KAW'].forEach(function(code){var index=MODE.indexOf(code);if(index>=0)$('<option>').val(index).text(code==='KAW'?'아무거나 잇기':L.modeKSH).appendTo(select);});$(select).trigger('change');});
  var tail=$('#RoomDiag .tail-button').first();
  $('<div id="unified-shield-row" class="dialog-bar"><label for="room-shield">보호막 횟수</label><input id="room-shield" type="number" min="0" max="100" step="1" value="15"><small>0회는 보호막 없이 시작합니다. 매너 모드에서는 항상 적용됩니다.</small></div>').insertBefore(tail);
  var row=$('<div id="unified-wordbook-row" class="dialog-bar"><label for="room-wordbook">낱말집</label><select id="room-wordbook"><option value="">기본 낱말집</option></select><button id="unified-wordbook-detail" type="button">낱말 보기</button></div>').insertBefore(tail);
  catalog.forEach(function(book){$('<option>').val(book.id).text(book.name).appendTo('#room-wordbook');});
  $('#RoomDiag').css({height:'auto','max-height':'90vh','overflow-y':'auto'});
  $('#room-limit').attr('max',10); // The shared server permits ten players.
  $('#SetRoomBtn').on('click.unifiedOptions',function(){var opts=$data.room&&$data.room.opts||{};$('#room-wordbook').val(opts.wordbook||'');$('#room-shield').val(opts.shield==null?15:opts.shield);});
  $('#NewRoomBtn').on('click.unifiedOptions',function(){$('#room-wordbook').val('');$('#room-shield').val(15);});
  $('<div id="ShieldStatus" role="status"></div><div id="TurnHint" aria-label="플레이어 힌트"></div>').appendTo('.GameBox .game-head');
  $('<button id="UnifiedWordSubmit" type="button">입력</button><div id="DraftStatus" role="status"></div>').appendTo($stage.game.here);
  $stage.game.here.insertBefore('.GameBox .game-body');
  var mode='answer',hints=[],compose=false;
  function classic(){return $data.room&&RULE[MODE[$data.room.mode]].rule==='Classic';}
  function status(){var room=$data.room;if(!room)return;$('#ShieldStatus').text(room.opts.manner?'보호막 · 매너 모드 상시':'남은 보호막: '+Math.max(0,Number(room.opts.shield==null?15:room.opts.shield)-Number($data.chain||0))+'회');}
  function inputMode(next){mode=next;$data._wordInputMode=next;$stage.game.here.show().css('display','flex').attr('data-mode',next);$stage.game.hereText.prop('readOnly',false).attr('placeholder',next==='answer'?'낱말 입력 · 힌트 사용 시 점수 50%':next==='hint'?'상대에게 알려줄 힌트 입력':'다음 차례 낱말 예측');$('#UnifiedWordSubmit').text(next==='answer'?'입력':next==='hint'?'힌트':'예측');}
  function submit(){if(!$data.room||!$data.room.gaming||$data._replay||compose)return;var value=$stage.game.hereText.val().trim();if(!value)return;if(mode==='answer'){send('talk',{value:value,relay:true});$stage.game.hereText.val('');}else send(mode==='hint'?'playerHint':'checkPrediction',{value:value});}
  // Keep normal chat separate from the game's answer/hint input.
  $stage.game.here.off('click');$stage.talk.off('keyup');$stage.game.hereText.off('keydown').on('compositionstart',function(){compose=true;}).on('compositionend',function(){compose=false;}).on('keydown.unifiedInput',function(e){if((e.key==='Enter'||e.keyCode===13)&&!compose&&!e.originalEvent?.isComposing){e.preventDefault();submit();}});
  $('#UnifiedWordSubmit').on('click',submit);
  $stage.chatBtn.off('click').on('click.unifiedChat',function(){var value=$stage.talk.val().trim();if(!value)return;if(value.charAt(0)==='/')runCommand(value.split(' '));else send('talk',{value:value,scope:$data.room?'room':'main'});$stage.talk.val('');});
  function useHint(index){if(mode==='answer'&&!$data._replay)send('usePlayerHint',{index:index});}
  $(document).on('keydown.unifiedHint',function(e){if(!classic()||!$data.room.gaming||compose||e.isComposing||e.ctrlKey||e.altKey||e.metaKey||$(e.target).is('#Talk,textarea,[contenteditable]'))return;if(/^[1-9]$/.test(e.key)&&hints[Number(e.key)-1]){e.preventDefault();useHint(Number(e.key)-1);}});
  var originalStart=$lib.Classic.turnStart,originalEnd=$lib.Classic.turnEnd,originalRound=$lib.Classic.roundReady;
  $lib.Classic.roundReady=function(data){originalRound(data);hints=[];$('#TurnHint,#DraftStatus').empty();status();};
  $lib.Classic.turnStart=function(data){$('.game-user-current').removeClass('game-user-current');originalStart(data);hints=[];$('#TurnHint,#DraftStatus').empty();inputMode($data._tid===$data.id?'answer':'hint');status();};
  $lib.Classic.turnEnd=function(id,data){originalEnd(id,data);status();if(data.hintUsed)$('#TurnHint button').eq(data.hintIndex).addClass('hint-used');if(data.ok&&!$data._replay)inputMode('prediction');};
  var originalMessage=onMessage;
  onMessage=function(data){
   if(data.type==='playerHints'){hints=data.hints||[];$('#TurnHint').empty();hints.forEach(function(hint,index){$('<button type="button">').text((index+1)+'. '+hint).appendTo('#TurnHint').on('click',function(){useHint(index);});});return;}
   if(data.type==='draftChecked'){$('#DraftStatus').text(data.valid?'낱말집 확인 완료':'선택한 낱말집에 없는 단어입니다.');return;}
   originalMessage(data);
   if(data.type==='room'&&$data.room&&$data.room.gaming&&$data._tid)selectById('game-user-'+$data._tid).addClass('game-user-current');
   if(data.type==='room'&&$data.room){status();if($data.room.opts.wordbook){var book=catalog.filter(function(b){return b.id===$data.room.opts.wordbook;})[0];$('#ShieldStatus').append($('<span>').text(' · 낱말집: '+(book?book.name:$data.room.opts.wordbook)));}}
  };
  // A small native dialog uses the shared dictionary without replacing Pearl's UI.
  var detail=$('<div class="dialog unified-wordbook-detail"><div class="dialog-head">낱말집 <button type="button">닫기</button></div><div class="dialog-body"><p role="status"></p><div class="unified-word-list"></div><button class="unified-word-prev" type="button">이전</button><button class="unified-word-next" type="button">다음</button></div></div>').appendTo('body'),page=1,bookId='';
  function load(){detail.find('p').text('불러오는 중…');$.getJSON('/api/wordbooks/'+encodeURIComponent(bookId)+'/words',{page:page}).done(function(data){var list=detail.find('.unified-word-list').empty();(data.words||[]).forEach(function(word){$('<p>').text(word.word+(word.mean?' · '+word.mean:'')).appendTo(list);});detail.find('p').text(page+'페이지');detail.find('.unified-word-prev').prop('disabled',page<=1);detail.find('.unified-word-next').prop('disabled',!data.hasMore);}).fail(function(){detail.find('p').text('낱말집을 불러오지 못했습니다. 다시 시도해 주세요.');});}
  $('#unified-wordbook-detail').on('click',function(){bookId=$('#room-wordbook').val();if(!bookId)return alert('낱말집을 선택해 주세요.');page=1;showDialog(detail);load();});detail.find('.dialog-head button').on('click',function(){detail.hide();});detail.find('.unified-word-prev').on('click',function(){if(page>1){page--;load();}});detail.find('.unified-word-next').on('click',function(){page++;load();});
 });
})();
