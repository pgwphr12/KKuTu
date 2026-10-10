/**
 * Rule the words! KKuTu Online
 * Copyright (C) 2017 JJoriping(op@jjo.kr)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

(function(){
	var $stage;
	var LIMIT = 400;
	var LIST;
	function isLoggedIn(){
		return $("#portal-authenticated").text() === "1";
	}


	$(document).ready(function(){
		$stage = {
			list: $("#server-list"),
			total: $("#server-total"),
			start: $("#game-start"),
			ref: $("#server-refresh"),
			refi: $("#server-refresh>i")
		};

		$("#Background").attr('src', "").addClass("jt-image").css({
			'background-image': "url(/img/kkutu/gamebg.png)",
			'background-size': "200px 200px"
		});


		// 로그인 직후 /servers 응답이 늦거나 일시적으로 실패해도 버튼 자체를
		// disabled 상태로 고정하지 않는다. 실제 접속 가능 서버는 클릭 시 판정한다.
		$stage.start.prop('disabled', false).on('click', function(e){
			var i, j, count;

			e.preventDefault();
			if(!isLoggedIn()){window.location.assign("/login");return false;}
			if(!Array.isArray(LIST)){
				alert(L['serverWait'] || '서버 목록을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
				seekServers();
				return false;
			}
			for(i=0.9; i<1; i+=0.01){
				for(j=0; j<LIST.length; j++){
					count = LIST[j];
					// JSON의 null(오프라인)을 0명 서버로 잘못 선택하지 않는다.
					if(typeof count === 'number' && isFinite(count) && count >= 0 && count < i * LIMIT){
						window.location.assign("/?server=" + j);
						return false;
					}
				}
			}
			alert(L['serverWait'] || '현재 접속 가능한 게임 서버가 없습니다. 잠시 후 다시 시도해 주세요.');
			seekServers();
			return false;
		});
		$stage.ref.on('click', function(e){
			if($stage.refi.hasClass("fa-spin")){
				return alert(L['serverWait']);
			}
			$stage.refi.addClass("fa-spin");
			setTimeout(seekServers, 1000);
		});
		setInterval(function(){
			$stage.ref.trigger('click');
		}, 60000);
		seekServers();
		if($("#login-required").text() === "1"){
			alert(L['loginRequired']);
		}
	});
	function seekServers(){
		$.get("/servers", function(data){
			var sum = 0;

			$stage.list.empty();
			LIST = data.list;
			data.list.forEach(function(v, i){
				var status = (v === null) ? "x" : "o";
				var people = (status == "x") ? "-" : (v + " / " + LIMIT);
				var limp = v / LIMIT * 100;
				var $e;

				sum += v || 0;
				if(status == "o"){
					if(limp >= 99) status = "q";
					else if(limp >= 90) status = "p";
				}
				$stage.list.append($e = $("<div>").addClass("server").attr('id', "server-" + i)
					.append($("<div>").addClass("server-status ss-" + status))
					.append($("<div>").addClass("server-name").html(L['server_' + i]))
					.append($("<div>").addClass("server-people graph")
						.append($("<div>").addClass("graph-bar").width(limp + "%"))
						.append($("<label>").html(people))
					)
					.append($("<div>").addClass("server-enter").html(L['serverEnter']))
				);
				if (status != "x") $e.on('click', function (e) {
					e.preventDefault();
					if(!isLoggedIn()){window.location.assign("/login");return false;}
					window.location.assign("/?server=" + i);
				}); else $e.children(".server-enter").html("-");
			});
			$stage.total.html("&nbsp;" + L['TOTAL'] + " " + sum + L['MN']);
			$stage.refi.removeClass("fa-spin");
			$stage.start.prop('disabled', false);
		}).fail(function(){
			// 네트워크/서버 상태 조회 실패가 게임 시작 버튼 잠금으로 이어지지 않게 한다.
			LIST = null;
			$stage.refi.removeClass("fa-spin");
			$stage.start.prop('disabled', false);
		});
	}
})();
