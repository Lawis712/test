/**
 * SillyTavern Persona Groups (用户人设分组)
 * Copyright (C) 2026  Lavi
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * ---
 * Based on / inspired by the Quick Persona extension from SillyTavern
 * (part of the SillyTavern project, https://github.com/SillyTavern/Extension-QuickPersona.git)
 * Licensed under AGPL-3.0
 */

import { extension_settings } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { power_user } from '../../../power-user.js';

const EXT_NAME = 'Persona Groups';
const EXT_DISPLAY = '用户人设分组';
const KEY = 'persona_groups';
const TOOLBAR_ID = 'pg-toolbar-container';
const PAGER_ID = 'pg-pager';
const BTN_ID = 'pg-quick-btn';
const POPUP_ID = 'pg-quick-popup';
const SETTINGS_ID = 'pg-extension-settings';
const VARIANT_POPUP_ID = 'pg-variant-popup';

// ========== 存储 ==========
function initStorage() {
    if (!extension_settings[KEY]) {
        extension_settings[KEY] = {
            groups: [],
            pageSize: 20,
            version: 3,
            groupsHidden: false,
            quickEnabled: true,
            mergeEnabled: false,
        };
        saveSettingsDebounced();
    }
    if (!extension_settings[KEY].groups) extension_settings[KEY].groups = [];
    if (!extension_settings[KEY].pageSize) extension_settings[KEY].pageSize = 20;
    if (typeof extension_settings[KEY].groupsHidden !== 'boolean') extension_settings[KEY].groupsHidden = false;
    if (typeof extension_settings[KEY].quickEnabled !== 'boolean') extension_settings[KEY].quickEnabled = true;
    if (typeof extension_settings[KEY].mergeEnabled !== 'boolean') extension_settings[KEY].mergeEnabled = false;
    saveSettingsDebounced();
}
function getGroups() { return extension_settings[KEY].groups; }
function getPageSize() { return extension_settings[KEY].pageSize || 20; }
function setPageSize(n) { extension_settings[KEY].pageSize = n; saveSettingsDebounced(); }
function isGroupsHidden() { return !!extension_settings[KEY].groupsHidden; }
function setGroupsHidden(v) { extension_settings[KEY].groupsHidden = !!v; saveSettingsDebounced(); }
function isQuickEnabled() { return !!extension_settings[KEY].quickEnabled; }
function setQuickEnabled(v) { extension_settings[KEY].quickEnabled = !!v; saveSettingsDebounced(); }
function isMergeEnabled() { return !!extension_settings[KEY].mergeEnabled; }
function setMergeEnabled(v) { extension_settings[KEY].mergeEnabled = !!v; saveSettingsDebounced(); }
function saveGroups() { saveSettingsDebounced(); }
function createGroup(name) {
    const id = 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    getGroups().push({ id, name: name || '新分组', collapsed: false, personas: [] });
    saveGroups();
}
function renameGroup(id, n) { const g = getGroups().find(x=>x.id===id); if(g){g.name=n;saveGroups();} }
function deleteGroup(id) { const gs = getGroups(); const i = gs.findIndex(x=>x.id===id); if(i>=0){gs.splice(i,1);saveGroups();} }
function toggleCollapse(id) { const g = getGroups().find(x=>x.id===id); if(g){g.collapsed=!g.collapsed;saveGroups();} }
function movePersonas(avatars, targetId) {
    for (const g of getGroups()) g.personas = g.personas.filter(a=>!avatars.includes(a));
    if (targetId) {
        const t = getGroups().find(x=>x.id===targetId);
        if (t) for (const a of avatars) if (!t.personas.includes(a)) t.personas.push(a);
    }
    saveGroups();
}

// ========== 工具 ==========
let _validAvatars = null;
let _validAvatarsSet = null;

async function refreshValidAvatars() {
    await loadPersonaApi();
    if (_getUserAvatars) {
        try {
            const list = await _getUserAvatars(false);
            if (Array.isArray(list)) {
                _validAvatars = list;
                _validAvatarsSet = new Set(list);
                return;
            }
        } catch (e) {
            console.warn('[' + EXT_NAME + '] getUserAvatars failed:', e);
        }
    }
    const personas = power_user.personas || {};
    _validAvatars = Object.keys(personas).filter(key => {
        if (!/[.\-_]/.test(key) && !/^\d/.test(key)) return false;
        const name = personas[key];
        if (typeof name === 'string' && (name.length > 200 || name.includes('\n'))) return false;
        return true;
    });
    _validAvatarsSet = new Set(_validAvatars);
}

function getAllAvatars() {
    if (_validAvatars) return _validAvatars;
    const personas = power_user.personas || {};
    return Object.keys(personas).filter(key => {
        if (!/[.\-_]/.test(key) && !/^\d/.test(key)) return false;
        const name = personas[key];
        if (typeof name === 'string' && (name.length > 200 || name.includes('\n'))) return false;
        return true;
    });
}

function isValidAvatar(a) {
    if (_validAvatarsSet) return _validAvatarsSet.has(a);
    return true;
}

function getName(a) {
    const raw = (power_user.personas || {})[a];
    if (typeof raw !== 'string') return a;
    if (raw.length > 200 || raw.includes('\n')) return a;
    return raw || a;
}
function getTitle(a) {
    const desc = (power_user.persona_descriptions || {})[a];
    if (!desc || typeof desc.title !== 'string') return '';
    return desc.title.trim();
}
function getDescription(a) {
    const desc = (power_user.persona_descriptions || {})[a];
    if (!desc || typeof desc.description !== 'string') return '';
    return desc.description;
}
function getAvatarUrl(a) { return '/thumbnail?type=persona&file=' + encodeURIComponent(a); }
function isBound(a) {
    const desc = (power_user.persona_descriptions || {})[a];
    if (desc) {
        if (desc.position === 'character') return true;
        if (Array.isArray(desc.connections) && desc.connections.length > 0) return true;
        if (desc.lockedFor && Array.isArray(desc.lockedFor) && desc.lockedFor.length > 0) return true;
    }
    const lockObjs = [power_user.personas_lock, power_user.lockedPersonas, power_user.persona_lock];
    for (const lock of lockObjs) {
        if (!lock || typeof lock !== 'object') continue;
        if (lock[a] !== undefined && lock[a] !== null && lock[a] !== '') return true;
        for (const k in lock) if (lock[k] === a) return true;
    }
    if (Array.isArray(power_user.persona_locked_chats) && power_user.persona_locked_chats.includes(a)) return true;
    return false;
}
function getCardAvatarId(card) {
    const inner = card.querySelector('.avatar[data-avatar-id]') || card.querySelector('[data-avatar-id]');
    if (inner && inner.dataset.avatarId) return inner.dataset.avatarId;
    if (card.dataset && card.dataset.avatarId) return card.dataset.avatarId;
    return null;
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function getFilterGroupId() {
    if (!state.filter || !state.filter.startsWith('group:')) return null;
    return state.filter.slice('group:'.length);
}

function isStQuickPersonaEnabled() {
    const qp = extension_settings.quickPersona;
    return !!(qp && qp.enabled === true);
}

// ========== U（Unit / 同名合并单元） ==========
/**
 * 决定 U 标识 —— 按 persona name 聚合
 * 返回：[{ key, name, variants: [avatar...], representative: avatar }]
 */
function buildUnits(avatarList) {
    const map = new Map();
    for (const a of avatarList) {
        const name = getName(a);
        const key = name; // 用名字本身做 key
        if (!map.has(key)) map.set(key, { key, name, variants: [] });
        map.get(key).variants.push(a);
    }
    // 决定每个 U 的代表变体（用于卡片显示）：
    // 优先级：当前选中 > 第一个绑定 > 第一个变体
    const units = [];
    for (const u of map.values()) {
        let rep = u.variants.find(a => isCurrent(a));
        if (!rep) rep = u.variants.find(a => isBound(a));
        if (!rep) rep = u.variants[0];
        u.representative = rep;
        units.push(u);
    }
    return units;
}

function isUnitBound(u) {
    return u.variants.some(a => isBound(a));
}
function unitBoundCount(u) {
    return u.variants.filter(a => isBound(a)).length;
}
function isUnitCurrent(u) {
    return u.variants.some(a => isCurrent(a));
}
/** U 是否匹配搜索关键词（搜 name + 所有变体的 title） */
function unitMatchesSearch(u, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    if (u.name.toLowerCase().includes(q)) return true;
    for (const a of u.variants) {
        const t = getTitle(a);
        if (t && t.toLowerCase().includes(q)) return true;
    }
    return false;
}
/** 单个 avatar 是否匹配搜索（搜 name + title） */
function avatarMatchesSearch(a, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    if (getName(a).toLowerCase().includes(q)) return true;
    const t = getTitle(a);
    if (t && t.toLowerCase().includes(q)) return true;
    return false;
}

// ========== ST API ==========
let _setUserAvatar = null;
let _getUserAvatars = null;
let _Popper = null;

async function loadPersonaApi() {
    if (_setUserAvatar) return;
    try {
        const m = await import('/scripts/personas.js');
        _setUserAvatar = m.setUserAvatar;
        _getUserAvatars = m.getUserAvatars;
    } catch (e) {
        console.warn('[' + EXT_NAME + '] Cannot load personas.js:', e);
    }
}
async function loadPopper() {
    if (_Popper !== null) return _Popper;
    try {
        const m = await import('/lib.js');
        _Popper = m.Popper || false;
    } catch (e) {
        _Popper = false;
        console.warn('[' + EXT_NAME + '] Popper not available, using manual positioning.');
    }
    return _Popper;
}
async function switchPersona(avatar) {
    await loadPersonaApi();
    if (_setUserAvatar) {
        try { await _setUserAvatar(avatar); return; }
        catch (e) { console.warn('[' + EXT_NAME + '] setUserAvatar failed:', e); }
    }
    const candidates = document.querySelectorAll('#user_avatar_block .avatar-container');
    for (const c of candidates) {
        if (getCardAvatarId(c) === avatar) {
            if (window.jQuery) window.jQuery(c).trigger('click');
            else c.click();
            return;
        }
    }
}

const state = { selectMode: false, selected: new Set(), filter: 'all', page: 0, search: '' };
let isReorganizing = false;

// ========== 扩展设置面板 ==========
function initExtensionSettings() {
    const container = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!container) {
        setTimeout(initExtensionSettings, 500);
        return;
    }
    if (document.getElementById(SETTINGS_ID)) return;

    const $panel = window.jQuery(`
        <div id="${SETTINGS_ID}" class="pg-extension-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>${EXT_DISPLAY}</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div class="pg-setting-row">
                        <label class="checkbox_label" for="pg-setting-quick-enabled">
                            <input type="checkbox" id="pg-setting-quick-enabled">
                            <span>启用快捷弹窗（输入栏旁边的小头像）</span>
                        </label>
                        <small class="pg-setting-hint" id="pg-setting-quick-hint" style="display:none; opacity:0.7; margin-top:4px; font-style:italic;"></small>
                    </div>
                    <div class="pg-setting-row" style="margin-top:10px;">
                        <label class="checkbox_label" for="pg-setting-merge-enabled">
                            <input type="checkbox" id="pg-setting-merge-enabled">
                            <span>合并同名人设（在主面板里把同名 U 显示为一张卡，点击后可切换具体内容）</span>
                        </label>
                        <small style="opacity:0.7; margin-top:4px; font-style:italic; display:block;">
                            适合喜欢用同一角色名、但有多套不同设定/描述的玩法。<br>
                            合并仅作用于主面板的展示层，底层数据不受影响；输入栏旁边的快捷弹窗不合并。<br>
                            多选模式下会自动按"变体"展示以便精确选择。
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `);
    window.jQuery(container).append($panel);

    const $cb = $panel.find('#pg-setting-quick-enabled');
    const $hint = $panel.find('#pg-setting-quick-hint');
    const $merge = $panel.find('#pg-setting-merge-enabled');

    function updateUI() {
        const enabled = isQuickEnabled();
        const stQpOn = isStQuickPersonaEnabled();
        $cb.prop('checked', enabled);
        if (stQpOn) {
            $cb.prop('disabled', true);
            $hint.text('⚠️ 检测到酒馆自带的 Quick Persona 扩展已启用，本插件的快捷弹窗已自动禁用以避免冲突。如需启用本插件的快捷弹窗，请先在扩展面板中关闭 Quick Persona。').show();
        } else {
            $cb.prop('disabled', false);
            $hint.hide();
        }
        $merge.prop('checked', isMergeEnabled());
    }

    $cb.on('change', function () {
        const v = $(this).prop('checked');
        setQuickEnabled(v);
        if (v && !isStQuickPersonaEnabled()) {
            initQuick();
        } else {
            removeQuickBtn();
        }
    });

    $merge.on('change', function () {
        const v = $(this).prop('checked');
        setMergeEnabled(v);
        state.page = 0;
        refreshMain();
    });

    updateUI();

    if (eventSource && event_types && event_types.SETTINGS_UPDATED) {
        eventSource.on(event_types.SETTINGS_UPDATED, () => {
            updateUI();
            const shouldShow = isQuickEnabled() && !isStQuickPersonaEnabled();
            const exists = !!document.getElementById(BTN_ID);
            if (shouldShow && !exists) initQuick();
            if (!shouldShow && exists) removeQuickBtn();
        });
    }
}

function removeQuickBtn() {
    const btn = document.getElementById(BTN_ID);
    if (btn) btn.remove();
    const popup = document.getElementById(POPUP_ID);
    if (popup) popup.remove();
    if (_popperInstance) {
        try { _popperInstance.destroy(); } catch(e) {}
        _popperInstance = null;
    }
}

// ========== 位置1：工具栏 + 重组原生 DOM ==========
function initMainPanel() {
    const tryInject = () => {
        const native = document.getElementById('user_avatar_block');
        if (!native) { setTimeout(tryInject, 500); return; }
        if (!document.getElementById(TOOLBAR_ID)) {
            const toolbar = document.createElement('div');
            toolbar.id = TOOLBAR_ID;
            toolbar.className = 'pg-toolbar-container';
            native.parentElement.insertBefore(toolbar, native);
        }
        if (!document.getElementById(PAGER_ID)) {
            const pager = document.createElement('div');
            pager.id = PAGER_ID;
            pager.className = 'pg-pager';
            const toolbar = document.getElementById(TOOLBAR_ID);
            toolbar.parentElement.insertBefore(pager, toolbar.nextSibling);
        }
        hideNativePagination();
        syncNativeSearch();
        renderToolbar();
        reorganizeNative();
    };
    tryInject();
}

function hideNativePagination() {
    const block = document.getElementById('user_avatar_block');
    if (!block) return;
    const col = block.parentElement;
    col.querySelectorAll('.paginationjs, .nav-tabs-paging, [class*="pagination"]').forEach(el => {
        el.classList.add('pg-hide-native-pager');
    });
}

function syncNativeSearch() {
    const searchInput = document.getElementById('persona_search_bar');
    if (!searchInput) return;
    if (searchInput.dataset.pgSearchHooked) return;
    searchInput.dataset.pgSearchHooked = '1';
    searchInput.addEventListener('input', () => {
        state.search = searchInput.value || '';
        state.page = 0;
        reorganizeNative();
    });
    state.search = searchInput.value || '';
}

function refreshMain() {
    const t = document.getElementById(TOOLBAR_ID);
    if (t) renderToolbar();
    reorganizeNative();
}

function renderToolbar() {
    const t = document.getElementById(TOOLBAR_ID);
    if (!t) return;
    const hidden = isGroupsHidden();
    const merge = isMergeEnabled();

    const currentGroupId = getFilterGroupId();
    if (currentGroupId && !getGroups().find(g => g.id === currentGroupId)) {
        state.filter = 'all';
    }

    let html = '<div class="pg-toolbar">';
    html += '<select class="pg-filter">';
    html += '<option value="all"' + (state.filter==='all'?' selected':'') + '>全部</option>';
    html += '<option value="bound"' + (state.filter==='bound'?' selected':'') + '>已绑定</option>';
    html += '<option value="unbound"' + (state.filter==='unbound'?' selected':'') + '>未绑定</option>';

    const groups = getGroups();
    if (groups.length > 0) {
        html += '<optgroup label="───୨ৎ─按分组─୨ৎ───">';
        for (const g of groups) {
            const v = 'group:' + g.id;
            html += '<option value="' + esc(v) + '"' + (state.filter===v?' selected':'') + '>' + esc(g.name) + '</option>';
        }
        html += '</optgroup>';
    }

    html += '</select>';
    html += '<button class="menu_button pg-btn-newgroup" title="新建分组"><i class="fa-solid fa-folder-plus"></i></button>';
    html += '<button class="menu_button pg-btn-selectmode' + (state.selectMode?' pg-active':'') + '" title="多选模式"><i class="fa-solid fa-check-double"></i></button>';
    html += '<button class="menu_button pg-btn-toggle-groups' + (hidden?' pg-active':'') + '" title="' + (hidden?'显示分组':'隐藏分组') + '"><i class="fa-solid ' + (hidden?'fa-eye-slash':'fa-eye') + '"></i></button>';
    html += '<button class="menu_button pg-btn-toggle-merge' + (merge?' pg-active':'') + '" title="' + (merge?'当前: 合并同名 (点击关闭)':'当前: 不合并 (点击合并同名)') + '"><i class="fa-solid ' + (merge?'fa-object-group':'fa-object-ungroup') + '"></i></button>';
    html += '</div>';

    if (state.selectMode) {
        html += '<div class="pg-selection-bar">';
        html += '<span>已选 <b>' + state.selected.size + '</b></span>';
        html += '<select class="pg-move-target"><option value="">— 移到分组 —</option>';
        for (const g of getGroups()) html += '<option value="' + g.id + '">' + esc(g.name) + '</option>';
        html += '<option value="__ungroup__">↓ 移出（未分组）</option></select>';
        html += '<button class="menu_button pg-btn-move">应用</button>';
        html += '<button class="menu_button pg-btn-clear-sel">清空</button>';
        html += '</div>';
    }
    if (merge && !state.selectMode) {
        html += '<div class="pg-merge-hint">合并同名模式：相同名字的人设已合并为一张卡片，点击卡片可切换具体内容。多选模式下会自动展开为变体。</div>';
    }
    t.innerHTML = html;
    bindToolbar(t);
}

function bindToolbar(t) {
    const filter = t.querySelector('.pg-filter');
    if (filter) filter.addEventListener('change', e => { state.filter = e.target.value; state.page = 0; refreshMain(); });
    const ng = t.querySelector('.pg-btn-newgroup');
    if (ng) ng.addEventListener('click', () => {
        const n = prompt('新分组名称：', '新分组');
        if (n && n.trim()) { createGroup(n.trim()); refreshMain(); }
    });
    const sm = t.querySelector('.pg-btn-selectmode');
    if (sm) sm.addEventListener('click', () => { state.selectMode = !state.selectMode; state.selected.clear(); refreshMain(); });
    const tg = t.querySelector('.pg-btn-toggle-groups');
    if (tg) tg.addEventListener('click', () => {
        setGroupsHidden(!isGroupsHidden());
        state.page = 0;
        refreshMain();
    });
    const tm = t.querySelector('.pg-btn-toggle-merge');
    if (tm) tm.addEventListener('click', () => {
        setMergeEnabled(!isMergeEnabled());
        state.page = 0;
        refreshMain();
    });

    if (state.selectMode) {
        const cb = t.querySelector('.pg-btn-clear-sel');
        if (cb) cb.addEventListener('click', () => { state.selected.clear(); refreshMain(); });
        const mb = t.querySelector('.pg-btn-move');
        if (mb) mb.addEventListener('click', () => {
            const v = t.querySelector('.pg-move-target').value;
            if (!v) return;
            const arr = [...state.selected];
            movePersonas(arr, v === '__ungroup__' ? null : v);
            state.selected.clear();
            refreshMain();
        });
    }
}

function renderPager(totalPages) {
    const p = document.getElementById(PAGER_ID);
    if (!p) return;
    if (totalPages <= 0) { p.innerHTML = ''; return; }
    if (state.page >= totalPages) state.page = totalPages - 1;
    if (state.page < 0) state.page = 0;
    const pageSize = getPageSize();
    const isFirst = state.page === 0;
    const isLast = state.page >= totalPages - 1;

    let html = '<div class="pg-pager-inner">';
    html += '<button class="menu_button pg-pager-first pg-pager-edge"' + (isFirst ? ' disabled' : '') + ' title="首页"><i class="fa-solid fa-angles-left"></i></button>';
    html += '<button class="menu_button pg-pager-prev"' + (isFirst ? ' disabled' : '') + ' title="上一页"><i class="fa-solid fa-chevron-left"></i></button>';
    html += '<span class="pg-pager-info">' + (state.page + 1) + '/' + totalPages + '</span>';
    html += '<button class="menu_button pg-pager-next"' + (isLast ? ' disabled' : '') + ' title="下一页"><i class="fa-solid fa-chevron-right"></i></button>';
    html += '<button class="menu_button pg-pager-last pg-pager-edge"' + (isLast ? ' disabled' : '') + ' title="末页"><i class="fa-solid fa-angles-right"></i></button>';
    html += '<select class="pg-pager-size" title="每页数量">';
    [5, 10, 25, 50, 100, 200].forEach(n => {
        html += '<option value="' + n + '"' + (pageSize === n ? ' selected' : '') + '>' + n + '</option>';
    });
    html += '</select>';
    html += '</div>';
    p.innerHTML = html;

    const first = p.querySelector('.pg-pager-first');
    if (first) first.addEventListener('click', () => { state.page = 0; reorganizeNative(); });
    const prev = p.querySelector('.pg-pager-prev');
    if (prev) prev.addEventListener('click', () => { state.page--; reorganizeNative(); });
    const next = p.querySelector('.pg-pager-next');
    if (next) next.addEventListener('click', () => { state.page++; reorganizeNative(); });
    const last = p.querySelector('.pg-pager-last');
    if (last) last.addEventListener('click', () => { state.page = totalPages - 1; reorganizeNative(); });
    const size = p.querySelector('.pg-pager-size');
    if (size) size.addEventListener('change', e => {
        setPageSize(parseInt(e.target.value, 10));
        state.page = 0;
        reorganizeNative();
    });
}

/**
 * 是否启用"U 合并"视图（合并开关 ON 且不在多选模式）
 */
function isMergeViewActive() {
    return isMergeEnabled() && !state.selectMode;
}

async function reorganizeNative() {
    const block = document.getElementById('user_avatar_block');
    if (!block) return;

    const scrollContainer = document.getElementById('PersonaManagement');
    const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    if (!_validAvatars) {
        await refreshValidAvatars();
    }

    const pager = document.getElementById(PAGER_ID);
    if (pager) pager.style.display = '';

    isReorganizing = true;
    try {
        // 清理上次的分组容器（把里面的 avatar-container 还原回 block）
        block.querySelectorAll(':scope > .pg-group-wrapper').forEach(w => {
            const body = w.querySelector('.pg-group-body');
            if (body) {
                Array.from(body.children).forEach(child => {
                    if (child.classList.contains('avatar-container')) {
                        block.appendChild(child);
                    }
                });
            }
            w.remove();
        });
        block.querySelectorAll(':scope > .pg-empty-hint').forEach(el => el.remove());
        // 清理上次的 U 卡片
        block.querySelectorAll(':scope > .pg-unit-card').forEach(el => el.remove());
        // 关闭已打开的变体弹窗
        closeVariantPopup();

        await ensureAllCardsInDom();

        const allCards = Array.from(block.querySelectorAll(':scope > .avatar-container'));
        const cardMap = new Map();
        for (const c of allCards) {
            const id = getCardAvatarId(c);
            if (id && isValidAvatar(id) && !cardMap.has(id)) cardMap.set(id, c);
        }
        // 默认全部隐藏，需要展示的才 display = ''
        allCards.forEach(c => c.style.display = 'none');

        const filterGroupId = getFilterGroupId();
        const isFilteringByGroup = !!filterGroupId;
        const hidden = isGroupsHidden();
        const mergeView = isMergeViewActive();
        const searchQuery = state.search.trim();
        const hasSearch = !!searchQuery;

        // ===== 单变体筛选（搜索/绑定） =====
        const passFilterAvatar = (avatar) => {
            if (!isFilteringByGroup) {
                if (state.filter === 'bound' && !isBound(avatar)) return false;
                if (state.filter === 'unbound' && isBound(avatar)) return false;
            }
            if (hasSearch && !avatarMatchesSearch(avatar, searchQuery)) return false;
            return true;
        };

        // ===== U 维度筛选 =====
        const passFilterUnit = (u) => {
            if (!isFilteringByGroup) {
                if (state.filter === 'bound' && !isUnitBound(u)) return false;
                if (state.filter === 'unbound' && isUnitBound(u)) return false;
            }
            if (hasSearch && !unitMatchesSearch(u, searchQuery)) return false;
            return true;
        };

        const groups = getGroups();
        const groupedSet = new Set();
        for (const g of groups) g.personas.forEach(a => groupedSet.add(a));
        const allAvatars = getAllAvatars().filter(a => cardMap.has(a));

        // 容器：放 U 卡片用（不污染 block 的 avatar-container 集合）
        // 我们把 U 卡片直接 append 到 block，但用 .pg-unit-card 类标识

        let totalPages = 1;

        // 一个统一的辅助：把"一个变体或一个 U"渲染成 DOM 节点并显示在某个父容器里
        // 普通模式渲染单个 avatar 卡：
        const showAvatarCard = (avatar, parent) => {
            const card = cardMap.get(avatar);
            if (!card) return;
            card.style.display = '';
            parent.appendChild(card);
        };
        // 合并模式渲染 U 卡：
        const showUnitCard = (u, parent) => {
            const card = buildUnitCard(u);
            parent.appendChild(card);
        };

        if (isFilteringByGroup) {
            // 按分组筛选：列出分组内的 personas（按变体或按 U）
            const targetGroup = groups.find(g => g.id === filterGroupId);
            const groupAvatars = targetGroup
                ? targetGroup.personas.filter(a => cardMap.has(a))
                : [];

            if (mergeView) {
                // 合并：把分组内的 avatars 聚合成 U（按 name），但变体只保留分组内的
                const units = buildUnits(groupAvatars).filter(passFilterUnit);
                const pageSize = getPageSize();
                totalPages = Math.max(1, Math.ceil(units.length / pageSize));
                if (state.page >= totalPages) state.page = totalPages - 1;
                if (state.page < 0) state.page = 0;
                const start = state.page * pageSize;
                const pageUnits = units.slice(start, start + pageSize);
                for (const u of pageUnits) showUnitCard(u, block);
            } else {
                const filtered = groupAvatars.filter(passFilterAvatar);
                const pageSize = getPageSize();
                totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
                if (state.page >= totalPages) state.page = totalPages - 1;
                if (state.page < 0) state.page = 0;
                const start = state.page * pageSize;
                const pageItems = filtered.slice(start, start + pageSize);
                for (const a of pageItems) showAvatarCard(a, block);
            }
        } else {
            // 非分组筛选：根据 mergeView/hidden/search 决定
            if (mergeView) {
                // ============= 合并视图 =============
                // 注意：分组里存的是 avatar 文件名。
                // 一个 U 的变体可能分散在不同分组里。
                // 设计：只要 U 的"任意一个变体"在某分组内，该 U 就显示在该分组下；
                // 如果 U 的所有变体都未分组，归到"未分组"区。
                const allUnits = buildUnits(allAvatars);

                // 给每个 U 标记：所属的分组 ids（可能多个）
                const unitGroupIds = new Map(); // unit.key -> Set<gid>
                for (const u of allUnits) {
                    const set = new Set();
                    for (const a of u.variants) {
                        for (const g of groups) {
                            if (g.personas.includes(a)) set.add(g.id);
                        }
                    }
                    unitGroupIds.set(u.key, set);
                }

                const ungroupedUnits = allUnits.filter(u => unitGroupIds.get(u.key).size === 0);
                const ungroupedUnitsFiltered = ungroupedUnits.filter(passFilterUnit);

                const pageSize = getPageSize();
                totalPages = Math.max(1, Math.ceil(ungroupedUnitsFiltered.length / pageSize));
                if (state.page >= totalPages) state.page = totalPages - 1;
                if (state.page < 0) state.page = 0;
                const start = state.page * pageSize;
                const pageUnits = ungroupedUnitsFiltered.slice(start, start + pageSize);

                if (!hidden) {
                    const fragmentsToPrepend = [];
                    for (const g of groups) {
                        const unitsInGroup = allUnits.filter(u => unitGroupIds.get(u.key).has(g.id));
                        const visibleUnits = unitsInGroup.filter(passFilterUnit);
                        const totalUnitsInGroup = unitsInGroup.length;
                        if (totalUnitsInGroup > 0 && visibleUnits.length === 0) continue;

                        const wrapper = document.createElement('div');
                        wrapper.className = 'pg-group-wrapper' + (g.collapsed ? ' pg-collapsed' : '');
                        if (totalUnitsInGroup === 0) wrapper.classList.add('pg-empty');
                        wrapper.dataset.gid = g.id;

                        const header = document.createElement('div');
                        header.className = 'pg-group-header';
                        const countText = totalUnitsInGroup === 0 ? '空' : visibleUnits.length;
                        header.innerHTML =
                            '<i class="fa-solid fa-chevron-down pg-toggle"></i>' +
                            '<span class="pg-group-name">' + esc(g.name) + '</span>' +
                            '<span class="pg-group-count">' + countText + '</span>' +
                            '<div class="pg-group-actions">' +
                            '<i class="fa-solid fa-pen pg-btn-rename" title="重命名"></i>' +
                            '<i class="fa-solid fa-trash pg-btn-delgroup" title="删除分组"></i>' +
                            '</div>';
                        wrapper.appendChild(header);

                        const body = document.createElement('div');
                        body.className = 'pg-group-body';
                        if (!g.collapsed && totalUnitsInGroup > 0) {
                            for (const u of visibleUnits) showUnitCard(u, body);
                        } else if (!g.collapsed && totalUnitsInGroup === 0) {
                            body.innerHTML = '<div class="pg-empty-hint">暂无人设，请用多选模式将人设移入此分组</div>';
                        }
                        wrapper.appendChild(body);
                        fragmentsToPrepend.push(wrapper);
                    }
                    for (let i = fragmentsToPrepend.length - 1; i >= 0; i--) {
                        block.insertBefore(fragmentsToPrepend[i], block.firstChild);
                    }
                }

                for (const u of pageUnits) showUnitCard(u, block);
            } else {
                // ============= 普通视图（按变体） =============
                const ungroupedAvatars = allAvatars.filter(a => !groupedSet.has(a));
                const ungroupedFiltered = ungroupedAvatars.filter(passFilterAvatar);
                const pageSize = getPageSize();
                totalPages = Math.max(1, Math.ceil(ungroupedFiltered.length / pageSize));
                if (state.page >= totalPages) state.page = totalPages - 1;
                if (state.page < 0) state.page = 0;
                const start = state.page * pageSize;
                const pageItems = ungroupedFiltered.slice(start, start + pageSize);

                if (!hidden) {
                    const fragmentsToPrepend = [];
                    for (const g of groups) {
                        const visibleInGroup = g.personas.filter(a => cardMap.has(a) && passFilterAvatar(a));
                        const totalPersonasInGroup = g.personas.filter(a => cardMap.has(a)).length;
                        if (totalPersonasInGroup > 0 && visibleInGroup.length === 0) continue;

                        const wrapper = document.createElement('div');
                        wrapper.className = 'pg-group-wrapper' + (g.collapsed ? ' pg-collapsed' : '');
                        if (totalPersonasInGroup === 0) wrapper.classList.add('pg-empty');
                        wrapper.dataset.gid = g.id;

                        const header = document.createElement('div');
                        header.className = 'pg-group-header';
                        const countText = totalPersonasInGroup === 0 ? '空' : visibleInGroup.length;
                        header.innerHTML =
                            '<i class="fa-solid fa-chevron-down pg-toggle"></i>' +
                            '<span class="pg-group-name">' + esc(g.name) + '</span>' +
                            '<span class="pg-group-count">' + countText + '</span>' +
                            '<div class="pg-group-actions">' +
                            '<i class="fa-solid fa-pen pg-btn-rename" title="重命名"></i>' +
                            '<i class="fa-solid fa-trash pg-btn-delgroup" title="删除分组"></i>' +
                            '</div>';
                        wrapper.appendChild(header);

                        const body = document.createElement('div');
                        body.className = 'pg-group-body';
                        if (!g.collapsed && totalPersonasInGroup > 0) {
                            for (const a of g.personas) {
                                if (cardMap.has(a) && passFilterAvatar(a)) {
                                    showAvatarCard(a, body);
                                }
                            }
                        } else if (!g.collapsed && totalPersonasInGroup === 0) {
                            body.innerHTML = '<div class="pg-empty-hint">暂无人设，请用多选模式将人设移入此分组</div>';
                        }
                        wrapper.appendChild(body);
                        fragmentsToPrepend.push(wrapper);
                    }
                    for (let i = fragmentsToPrepend.length - 1; i >= 0; i--) {
                        block.insertBefore(fragmentsToPrepend[i], block.firstChild);
                    }
                }

                for (const a of pageItems) showAvatarCard(a, block);
            }
        }

        applySelectModeUI();
        bindWrappers(block);
        renderPager(totalPages);
    } finally {
        requestAnimationFrame(() => {
            isReorganizing = false;
            if (scrollContainer && savedScrollTop > 0) {
                scrollContainer.scrollTop = savedScrollTop;
            }
        });
    }
}

/**
 * 构建一个 U 卡片元素
 */
function buildUnitCard(u) {
    const rep = u.representative;
    const card = document.createElement('div');
    card.className = 'pg-unit-card avatar-container interactable';
    card.dataset.unitKey = u.key;
    card.dataset.avatarId = rep; // 让 ST 内部可能的查询找到一个实变体（兜底）
    card.tabIndex = 0;

    const variantCount = u.variants.length;
    const boundCount = unitBoundCount(u);
    const current = isUnitCurrent(u);
    if (current) card.classList.add('selected');

    const repTitle = getTitle(rep);
    const displayName = getName(rep);
    const repDesc = getDescription(rep);

    const titleHtml = repTitle
        ? '<small class="ch_additional_info">' + esc(repTitle) + '</small>'
        : '';

    const variantBadge = variantCount > 1
        ? '<span class="pg-unit-badge" title="这个角色有 ' + variantCount + ' 套设定">×' + variantCount + '</span>'
        : '';
    const boundBadge = (boundCount > 0 && variantCount > 1)
        ? '<span class="pg-unit-bound-badge" title="' + boundCount + '/' + variantCount + ' 个变体已绑定">' + boundCount + '/' + variantCount + ' 🔒</span>'
        : '';

    card.innerHTML =
        '<div class="avatar" data-avatar-id="' + esc(rep) + '" title="' + esc(rep) + '">' +
            '<img src="' + getAvatarUrl(rep) + '" alt="' + esc(displayName) + '">' +
            variantBadge +
        '</div>' +
        '<div class="flex-container wide100pLess70px character_select_container">' +
            '<div class="wide100p character_name_block">' +
                '<span class="ch_name flex1">' + esc(displayName) + '</span>' +
                titleHtml +
            '</div>' +
            '<div class="ch_description">' + esc(repDesc || '[点击切换设定]') + '</div>' +
            '<div class="avatar_container_states buttons_block">' +
                boundBadge +
            '</div>' +
        '</div>';

    card.addEventListener('click', (e) => {
        if (state.selectMode) return; // 多选下不该出现 U 卡，但兜底
        e.preventDefault();
        e.stopPropagation();
        if (variantCount === 1) {
            // 只有一个变体，直接切
            switchPersona(u.variants[0]);
        } else {
            openVariantPopup(card, u);
        }
    });

    return card;
}

// ========== 变体选择弹窗 ==========
function closeVariantPopup() {
    const p = document.getElementById(VARIANT_POPUP_ID);
    if (p) p.remove();
    if (window.__pg_variant_outside) {
        document.removeEventListener('click', window.__pg_variant_outside, true);
        window.__pg_variant_outside = null;
    }
}

function openVariantPopup(anchorCard, u) {
    closeVariantPopup();
    const popup = document.createElement('div');
    popup.id = VARIANT_POPUP_ID;
    popup.className = 'pg-variant-popup';

    let html = '<div class="pg-variant-header">' +
                   '<span>切换 “' + esc(u.name) + '” 的设定</span>' +
                   '<i class="fa-solid fa-xmark pg-variant-close" title="关闭"></i>' +
               '</div>';
    html += '<div class="pg-variant-list">';
    for (const a of u.variants) {
        const t = getTitle(a) || '（无备注）';
        const cur = isCurrent(a);
        const bound = isBound(a);
        html += '<div class="pg-variant-item' + (cur ? ' pg-current' : '') + '" data-avatar="' + esc(a) + '">' +
                    '<img src="' + getAvatarUrl(a) + '" alt="">' +
                    '<div class="pg-variant-meta">' +
                        '<div class="pg-variant-title">' + esc(t) + (cur ? ' <span class="pg-variant-tag pg-tag-cur">当前</span>' : '') + (bound ? ' <span class="pg-variant-tag pg-tag-bound">🔒</span>' : '') + '</div>' +
                        '<div class="pg-variant-id" title="' + esc(a) + '">' + esc(a) + '</div>' +
                    '</div>' +
                '</div>';
    }
    html += '</div>';
    popup.innerHTML = html;
    document.body.appendChild(popup);

    // 定位（相对 anchorCard）
    positionVariantPopup(popup, anchorCard);

    // 事件
    popup.querySelector('.pg-variant-close').addEventListener('click', closeVariantPopup);
    popup.querySelectorAll('.pg-variant-item').forEach(el => {
        el.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const a = el.dataset.avatar;
            await switchPersona(a);
            closeVariantPopup();
        });
    });

    // 点击外部关闭
    setTimeout(() => {
        const handler = (e) => {
            if (e.target.closest('#' + VARIANT_POPUP_ID)) return;
            if (e.target.closest('.pg-unit-card')) return;
            closeVariantPopup();
        };
        window.__pg_variant_outside = handler;
        document.addEventListener('click', handler, true);
    }, 0);
}

function positionVariantPopup(popup, anchor) {
    const r = anchor.getBoundingClientRect();
    popup.style.position = 'fixed';
    const pw = Math.min(360, window.innerWidth - 16);
    popup.style.width = pw + 'px';
    // 默认放卡片右侧；放不下则放下方
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.right + margin;
    let top = r.top;
    const ph = popup.offsetHeight || 300;
    if (left + pw + margin > vw) {
        // 右边放不下，尝试放下方
        left = Math.max(margin, Math.min(r.left, vw - pw - margin));
        top = r.bottom + margin;
        if (top + ph + margin > vh) {
            // 下方也放不下，放上方
            top = Math.max(margin, r.top - ph - margin);
        }
    } else {
        if (top + ph + margin > vh) top = Math.max(margin, vh - ph - margin);
    }
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
}

async function ensureAllCardsInDom() {
    const block = document.getElementById('user_avatar_block');
    if (!block) return;

    const allAvatars = getAllAvatars();

    const presentInDom = new Set();
    block.querySelectorAll(':scope > .avatar-container').forEach(c => {
        if (c.classList.contains('pg-unit-card')) return;
        const id = getCardAvatarId(c);
        if (id) presentInDom.add(id);
    });

    const missing = allAvatars.filter(a => !presentInDom.has(a));
    if (missing.length === 0) return;

    await loadPersonaApi();
    if (_getUserAvatars) {
        try { await _getUserAvatars(false); } catch(e) {}
    }

    const presentAfter = new Set();
    block.querySelectorAll(':scope > .avatar-container').forEach(c => {
        if (c.classList.contains('pg-unit-card')) return;
        const id = getCardAvatarId(c);
        if (id) presentAfter.add(id);
    });
    const stillMissing = allAvatars.filter(a => !presentAfter.has(a));
    if (stillMissing.length === 0) return;

    const template = block.querySelector(':scope > .avatar-container:not(.pg-unit-card)');
    if (!template) return;

    for (const avatar of stillMissing) {
        const clone = template.cloneNode(true);
        clone.classList.remove('selected');
        clone.classList.remove('pg-unit-card');

        clone.dataset.avatarId = avatar;
        clone.setAttribute('title', avatar);
        clone.querySelectorAll('[data-avatar-id]').forEach(el => {
            el.dataset.avatarId = avatar;
            el.setAttribute('title', avatar);
        });

        clone.querySelectorAll('img').forEach(img => {
            img.src = getAvatarUrl(avatar);
            img.alt = getName(avatar);
            img.removeAttribute('srcset');
        });

        clone.querySelectorAll('.ch_name, .character_name').forEach(el => {
            el.textContent = getName(avatar);
        });

        const desc = (power_user.persona_descriptions || {})[avatar] || {};
        const realDesc = desc.description || '';
        clone.querySelectorAll('.ch_description').forEach(el => {
            el.textContent = realDesc;
        });

        const realTitle = (typeof desc.title === 'string') ? desc.title.trim() : '';
        const nameBlock = clone.querySelector('.character_name_block');
        let infoEl = clone.querySelector('.ch_additional_info');
        if (realTitle) {
            if (!infoEl && nameBlock) {
                infoEl = document.createElement('small');
                infoEl.className = 'ch_additional_info';
                nameBlock.appendChild(infoEl);
            }
            if (infoEl) infoEl.textContent = realTitle;
        } else {
            if (infoEl) infoEl.remove();
        }

        delete clone.dataset.pgClickHooked;

        clone.addEventListener('click', async (e) => {
            if (state.selectMode) return;
            const before = power_user.user_avatar;
            setTimeout(async () => {
                if (power_user.user_avatar === before) {
                    await switchPersona(avatar);
                }
            }, 50);
        });

        block.appendChild(clone);
    }
}

function applySelectModeUI() {
    const block = document.getElementById('user_avatar_block');
    if (!block) return;
    block.querySelectorAll('.pg-check').forEach(cb => cb.remove());
    block.querySelectorAll('.avatar-container').forEach(c => {
        c.classList.remove('pg-select-mode', 'pg-checked');
    });
    if (!state.selectMode) return;

    // 多选模式下：U 卡片不应出现（在 reorganize 里就已被关闭），这里只作用于真实 avatar 卡
    block.querySelectorAll('.avatar-container').forEach(c => {
        if (c.classList.contains('pg-unit-card')) return;
        const id = getCardAvatarId(c);
        if (!id) return;
        c.classList.add('pg-select-mode');
        if (state.selected.has(id)) c.classList.add('pg-checked');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'pg-check';
        cb.checked = state.selected.has(id);
        cb.addEventListener('click', e => {
            e.stopPropagation();
            if (state.selected.has(id)) state.selected.delete(id);
            else state.selected.add(id);
            applySelectModeUI();
            updateSelectionCount();
        });

        if (!c.dataset.pgClickHooked) {
            c.dataset.pgClickHooked = '1';
            c.addEventListener('click', interceptInSelectMode, true);
        }
        c.appendChild(cb);
    });
}

function updateSelectionCount() {
    const t = document.getElementById(TOOLBAR_ID);
    if (!t) return;
    const span = t.querySelector('.pg-selection-bar > span b');
    if (span) span.textContent = state.selected.size;
}

function interceptInSelectMode(e) {
    if (!state.selectMode) return;
    if (e.target.classList.contains('pg-check')) return;
    e.stopPropagation();
    e.preventDefault();
    const id = getCardAvatarId(e.currentTarget);
    if (!id) return;
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    applySelectModeUI();
    updateSelectionCount();
}

function bindWrappers(block) {
    block.querySelectorAll(':scope > .pg-group-wrapper').forEach(div => {
        const gid = div.dataset.gid;
        const header = div.querySelector('.pg-group-header');
        if (header && !header.dataset.pgBound) {
            header.dataset.pgBound = '1';
            header.addEventListener('click', e => {
                if (e.target.closest('.pg-group-actions')) return;
                toggleCollapse(gid);
                refreshMain();
            });
        }
        const rn = div.querySelector('.pg-btn-rename');
        if (rn && !rn.dataset.pgBound) {
            rn.dataset.pgBound = '1';
            rn.addEventListener('click', e => {
                e.stopPropagation();
                const cur = (getGroups().find(x => x.id === gid) || {}).name || '';
                const n = prompt('重命名：', cur);
                if (n && n.trim()) { renameGroup(gid, n.trim()); refreshMain(); }
            });
        }
        const db = div.querySelector('.pg-btn-delgroup');
        if (db && !db.dataset.pgBound) {
            db.dataset.pgBound = '1';
            db.addEventListener('click', e => {
                e.stopPropagation();
                if (confirm('删除该分组？')) { deleteGroup(gid); refreshMain(); }
            });
        }
    });
}

// ========== 位置2：快捷弹窗（不合并） ==========
let _popperInstance = null;

function initQuick() {
    if (!isQuickEnabled()) return;
    if (isStQuickPersonaEnabled()) return;

    const tryInject = () => {
        const leftForm = document.getElementById('leftSendForm');
        if (!leftForm) { setTimeout(tryInject, 500); return; }
        if (document.getElementById(BTN_ID)) return;

        const $btn = window.jQuery(
            '<div id="' + BTN_ID + '" class="interactable" tabindex="0" title="人设分组（快捷切换）" role="button">' +
            '<img class="pg-quick-btn-img" alt="">' +
            '<i class="fa-solid fa-user-circle pg-fallback-icon" style="display:none;"></i>' +
            '</div>'
        );
        window.jQuery(leftForm).append($btn);

        $btn.on('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleQuick();
        });

        setTimeout(updateQuickBtnAvatar, 100);
        setTimeout(updateQuickBtnAvatar, 1000);
        setTimeout(updateQuickBtnAvatar, 3000);
    };
    tryInject();

    if (!window.__pg_body_click_hooked) {
        window.__pg_body_click_hooked = true;
        window.jQuery(document.body).on('click.pgQuick', (e) => {
            const p = document.getElementById(POPUP_ID);
            if (!p || p.style.display === 'none') return;
            if (e.target.closest('#' + POPUP_ID)) return;
            if (e.target.closest('#' + BTN_ID)) return;
            closeQuick();
        });
    }
}

function updateQuickBtnAvatar() {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const img = btn.querySelector('.pg-quick-btn-img');
    const fallback = btn.querySelector('.pg-fallback-icon');
    if (!img) return;
    let cur = power_user.user_avatar || power_user.default_persona;
    if (!cur) {
        const sel = document.querySelector('#user_avatar_block .avatar-container.selected [data-avatar-id]')
                 || document.querySelector('#user_avatar_block [data-avatar-id].selected');
        if (sel) cur = sel.dataset.avatarId;
    }
    if (!cur) {
        const first = document.querySelector('#user_avatar_block [data-avatar-id]');
        if (first) cur = first.dataset.avatarId;
    }
    if (cur) {
        const newSrc = getAvatarUrl(cur);
        if (img.getAttribute('data-current') !== cur) {
            img.src = newSrc;
            img.alt = getName(cur);
            img.setAttribute('data-current', cur);
        }
        img.style.display = '';
        if (fallback) fallback.style.display = 'none';
    } else {
        img.style.display = 'none';
        if (fallback) fallback.style.display = '';
    }
}

function refreshQuick() {
    updateQuickBtnAvatar();
    const p = document.getElementById(POPUP_ID);
    if (p && p.style.display !== 'none') renderQuick();
}

async function toggleQuick() {
    let p = document.getElementById(POPUP_ID);
    if (p && p.style.display !== 'none') {
        closeQuick();
        return;
    }
    if (!p) {
        p = document.createElement('div');
        p.id = POPUP_ID;
        p.className = 'pg-quick-popup';
        document.body.appendChild(p);
    }
    p.style.display = 'block';
    renderQuick();
    await positionQuick(p);
}

function closeQuick() {
    const p = document.getElementById(POPUP_ID);
    if (!p) return;
    p.style.display = 'none';
    if (_popperInstance) {
        try { _popperInstance.destroy(); } catch(e) {}
        _popperInstance = null;
    }
}

async function positionQuick(p) {
    const b = document.getElementById(BTN_ID);
    if (!b) return;

    const Popper = await loadPopper();

    if (Popper && typeof Popper.createPopper === 'function') {
        try {
            if (_popperInstance) {
                try { _popperInstance.destroy(); } catch(e) {}
                _popperInstance = null;
            }
            p.style.position = '';
            p.style.left = '';
            p.style.top = '';
            p.style.bottom = '';

            _popperInstance = Popper.createPopper(b, p, {
                placement: 'top-start',
                modifiers: [
                    { name: 'offset', options: { offset: [0, 8] } },
                    { name: 'preventOverflow', options: { padding: 8 } },
                    { name: 'flip', options: { fallbackPlacements: ['bottom-start', 'top-end', 'bottom-end'] } },
                ],
            });
            return;
        } catch (e) {
            console.warn('[' + EXT_NAME + '] Popper failed, fallback to manual:', e);
        }
    }

    const r = b.getBoundingClientRect();
    p.style.position = 'fixed';
    const pw = p.offsetWidth || 320;
    const ph = p.offsetHeight || 400;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    let bottom = vh - r.top + 8;
    let left = r.left - 100;
    if (left < margin) left = margin;
    if (left + pw + margin > vw) left = Math.max(margin, vw - pw - margin);
    if (bottom + ph > vh - margin && r.bottom + 8 + ph < vh - margin) {
        p.style.bottom = '';
        p.style.top = (r.bottom + 8) + 'px';
    } else {
        p.style.top = '';
        p.style.bottom = bottom + 'px';
    }
    p.style.left = left + 'px';
}

function isCurrent(a) {
    if (power_user.user_avatar === a) return true;
    if (power_user.default_persona === a) return true;
    return false;
}

function renderQuick() {
    const p = document.getElementById(POPUP_ID);
    if (!p) return;
    const all = getAllAvatars();
    const grouped = new Set();
    let h = '<div class="pg-quick-header">切换人设</div>';
    for (const g of getGroups()) {
        const ps = g.personas.filter(a => all.includes(a));
        ps.forEach(a => grouped.add(a));
        if (ps.length === 0) continue;
        h += '<div class="pg-quick-group' + (g.collapsed?' pg-collapsed':'') + '" data-gid="' + g.id + '">';
        h += '<div class="pg-quick-group-header"><i class="fa-solid fa-chevron-down"></i><span>' + esc(g.name) + '</span><span class="pg-quick-count">' + ps.length + '</span></div>';
        h += '<div class="pg-quick-grid">';
        for (const a of ps) h += renderQuickAv(a);
        h += '</div></div>';
    }
    const ung = all.filter(a => !grouped.has(a));
    if (ung.length > 0) {
        h += '<div class="pg-quick-ungrouped"><div class="pg-quick-grid">';
        for (const a of ung) h += renderQuickAv(a);
        h += '</div></div>';
    }
    p.innerHTML = h;

    window.jQuery(p).find('.pg-quick-avatar').on('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        const a = this.dataset.avatar;
        document.querySelectorAll('.pg-quick-avatar.pg-current').forEach(x => x.classList.remove('pg-current'));
        this.classList.add('pg-current');
        await switchPersona(a);
        setTimeout(updateQuickBtnAvatar, 50);
        closeQuick();
    });
    window.jQuery(p).find('.pg-quick-group-header').on('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleCollapse(this.parentElement.dataset.gid);
        renderQuick();
        const popup = document.getElementById(POPUP_ID);
        if (popup) await positionQuick(popup);
    });
}

function renderQuickAv(a) {
    // 在 quick 弹窗里显示「名字 + 备注」以便区分同名人设
    const t = getTitle(a);
    const tipText = t ? (getName(a) + ' · ' + t) : getName(a);
    return '<div class="pg-quick-avatar' + (isCurrent(a)?' pg-current':'') + '" data-avatar="' + esc(a) + '" title="' + esc(tipText) + '"><img src="' + getAvatarUrl(a) + '"></div>';
}

// ========== 入口 ==========
jQuery(async () => {
    console.log('[' + EXT_NAME + '] Loading...');
    initStorage();
    await loadPersonaApi();
    loadPopper();
    await refreshValidAvatars();

    try { initExtensionSettings(); console.log('[' + EXT_NAME + '] Settings panel initialized.'); }
    catch (err) { console.error('[' + EXT_NAME + '] Settings panel init failed:', err); }

    try { initMainPanel(); console.log('[' + EXT_NAME + '] Main panel initialized.'); }
    catch (err) { console.error('[' + EXT_NAME + '] Main panel init failed:', err); }

    if (isQuickEnabled() && !isStQuickPersonaEnabled()) {
        try { initQuick(); console.log('[' + EXT_NAME + '] Quick panel initialized.'); }
        catch (err) { console.error('[' + EXT_NAME + '] Quick panel init failed:', err); }
    } else if (isStQuickPersonaEnabled()) {
        console.log('[' + EXT_NAME + '] Quick popup skipped (ST Quick Persona is enabled).');
    } else {
        console.log('[' + EXT_NAME + '] Quick popup disabled by user settings.');
    }

    const refreshAll = async () => {
        await refreshValidAvatars();
        try { refreshMain(); } catch(e){}
        try { refreshQuick(); } catch(e){}
    };
    if (eventSource && event_types) {
        if (event_types.SETTINGS_UPDATED) eventSource.on(event_types.SETTINGS_UPDATED, refreshAll);
        if (event_types.CHAT_CHANGED) eventSource.on(event_types.CHAT_CHANGED, refreshAll);
    }

    const obs = document.getElementById('user_avatar_block');
    if (obs) {
        new MutationObserver(() => {
            if (isReorganizing) return;
            clearTimeout(window.__pg_reorg_timer);
            window.__pg_reorg_timer = setTimeout(reorganizeNative, 100);
        }).observe(obs, { childList: true, subtree: false });
    }

    window.addEventListener('resize', () => {
        const p = document.getElementById(POPUP_ID);
        if (p && p.style.display !== 'none') {
            if (_popperInstance) {
                try { _popperInstance.update(); } catch(e) {}
            } else {
                positionQuick(p);
            }
        }
    });

    console.log('[' + EXT_NAME + '] Loaded successfully.');
});
