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

const EXT_NAME = 'tttest';
const EXT_DISPLAY = 'tttest';
const KEY = 'persona_groups-test';
const TOOLBAR_ID = 'pg-toolbar-container';
const PAGER_ID = 'pg-pager';
const BTN_ID = 'pg-quick-btn';
const POPUP_ID = 'pg-quick-popup';
const SETTINGS_ID = 'pg-extension-settings';

// ========== 存储 ==========
function initStorage() {
    if (!extension_settings[KEY]) {
        extension_settings[KEY] = {
            groups: [],
            pageSize: 20,
            version: 2,
            groupsHidden: false,
            quickEnabled: true,
            mergeByName: false,
            expandedClusters: [],
        };
        saveSettingsDebounced();
    }
    if (!extension_settings[KEY].groups) extension_settings[KEY].groups = [];
    if (!extension_settings[KEY].pageSize) extension_settings[KEY].pageSize = 20;
    if (typeof extension_settings[KEY].groupsHidden !== 'boolean') extension_settings[KEY].groupsHidden = false;
    if (typeof extension_settings[KEY].quickEnabled !== 'boolean') extension_settings[KEY].quickEnabled = true;
    if (typeof extension_settings[KEY].mergeByName !== 'boolean') extension_settings[KEY].mergeByName = false;
    if (!Array.isArray(extension_settings[KEY].expandedClusters)) extension_settings[KEY].expandedClusters = [];
    saveSettingsDebounced();
}
function getGroups() { return extension_settings[KEY].groups; }
function getPageSize() { return extension_settings[KEY].pageSize || 20; }
function setPageSize(n) { extension_settings[KEY].pageSize = n; saveSettingsDebounced(); }
function isGroupsHidden() { return !!extension_settings[KEY].groupsHidden; }
function setGroupsHidden(v) { extension_settings[KEY].groupsHidden = !!v; saveSettingsDebounced(); }
function isQuickEnabled() { return !!extension_settings[KEY].quickEnabled; }
function setQuickEnabled(v) { extension_settings[KEY].quickEnabled = !!v; saveSettingsDebounced(); }
function isMergeByName() { return !!extension_settings[KEY].mergeByName; }
function setMergeByName(v) { extension_settings[KEY].mergeByName = !!v; saveSettingsDebounced(); }
function getExpandedClusters() {
    if (!Array.isArray(extension_settings[KEY].expandedClusters)) extension_settings[KEY].expandedClusters = [];
    return extension_settings[KEY].expandedClusters;
}
function isClusterExpanded(name) { return getExpandedClusters().includes(name); }
function toggleClusterExpand(name) {
    const arr = getExpandedClusters();
    const i = arr.indexOf(name);
    if (i >= 0) arr.splice(i, 1);
    else arr.push(name);
    saveSettingsDebounced();
}
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
    if (desc && typeof desc.title === 'string') return desc.title.trim();
    return '';
}
function getDescription(a) {
    const desc = (power_user.persona_descriptions || {})[a];
    if (desc && typeof desc.description === 'string') return desc.description;
    return '';
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

// ========== 同名簇 ==========
/**
 * 把一组 avatars 按 name 分簇。
 * 返回 { clusters: [{name, avatars: [a, a, ...]}], avatarToCluster: Map<avatar, clusterRef> }
 * 簇内 avatars 顺序 = 输入顺序
 * clusters 顺序 = 每个簇首次出现的顺序
 */
function buildClusters(avatars) {
    const map = new Map(); // name -> cluster
    const clusters = [];
    const avatarToCluster = new Map();
    for (const a of avatars) {
        const name = getName(a);
        let c = map.get(name);
        if (!c) {
            c = { name, avatars: [] };
            map.set(name, c);
            clusters.push(c);
        }
        c.avatars.push(a);
        avatarToCluster.set(a, c);
    }
    return { clusters, avatarToCluster };
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
                        <label class="checkbox_label" for="pg-setting-merge-byname">
                            <input type="checkbox" id="pg-setting-merge-byname">
                            <span>合并同名人设（同名折叠为一张卡，展开后切换变体）</span>
                        </label>
                        <small class="pg-setting-hint" style="opacity:0.7; margin-top:4px; font-style:italic; display:block;">
                            适合"同一个角色，多套设定"的玩法。仅影响位置1（管理面板）。多选模式下自动展平。
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `);
    window.jQuery(container).append($panel);

    const $cb = $panel.find('#pg-setting-quick-enabled');
    const $hint = $panel.find('#pg-setting-quick-hint');
    const $mb = $panel.find('#pg-setting-merge-byname');

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
        $mb.prop('checked', isMergeByName());
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

    $mb.on('change', function () {
        const v = $(this).prop('checked');
        setMergeByName(v);
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
    const merge = isMergeByName();

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
    html += '<button class="menu_button pg-btn-toggle-merge' + (merge?' pg-active':'') + '" title="' + (merge?'展开同名':'合并同名') + '"><i class="fa-solid ' + (merge?'fa-layer-group':'fa-object-ungroup') + '"></i></button>';
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
        html += '<div class="pg-merge-hint">📚 已开启同名合并：相同名字的人设折叠为一张卡，点右上角徽章 <span class="pg-merge-hint-badge">×N</span> 展开变体</div>';
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
        setMergeByName(!isMergeByName());
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
 * 在合并模式下，对一个 avatar 列表做"簇折叠"：
 * 输入：[a1, a2, a3, a4]（其中 a1, a3 同名）
 * 输出：[a1, a2, a4] —— 同名簇只保留代表（第一个）
 */
function collapseToRepresentatives(avatars) {
    const seen = new Set();
    const out = [];
    for (const a of avatars) {
        const name = getName(a);
        if (seen.has(name)) continue;
        seen.add(name);
        out.push(a);
    }
    return out;
}

/**
 * 拿到名字下的所有变体（按 allAvatars 中的顺序）
 */
function getVariantsOfName(name, allAvatars) {
    return allAvatars.filter(a => getName(a) === name);
}

async function reorganizeNative() {
    const block = document.getElementById('user_avatar_block');
    if (!block) return;

    const scrollContainer = document.getElementById('PersonaManagement');
    const savedScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;

    if (!_validAvatars) {
        await refreshValidAvatars();
    }

    if (state.search.trim()) {
        // 搜索模式：完全展开（不合并），由 ST 原生搜索决定显示
        isReorganizing = true;
        try {
            cleanupCustomDom(block);
            block.querySelectorAll(':scope > .avatar-container').forEach(c => {
                c.style.display = '';
            });
            applySelectModeUI();
            const pager = document.getElementById(PAGER_ID);
            if (pager) pager.style.display = 'none';
        } finally {
            requestAnimationFrame(() => {
                isReorganizing = false;
                if (scrollContainer && savedScrollTop > 0) {
                    scrollContainer.scrollTop = savedScrollTop;
                }
            });
        }
        return;
    }

    const pager = document.getElementById(PAGER_ID);
    if (pager) pager.style.display = '';

    isReorganizing = true;
    try {
        cleanupCustomDom(block);

        await ensureAllCardsInDom();

        const allCards = Array.from(block.querySelectorAll(':scope > .avatar-container'));
        const cardMap = new Map();
        for (const c of allCards) {
            const id = getCardAvatarId(c);
            if (id && isValidAvatar(id) && !cardMap.has(id)) cardMap.set(id, c);
        }
        allCards.forEach(c => c.style.display = 'none');

        const filterGroupId = getFilterGroupId();
        const isFilteringByGroup = !!filterGroupId;
        const hidden = isGroupsHidden();
        // 多选模式下强制展平，方便精确选择
        const merge = isMergeByName() && !state.selectMode;

        // 单 avatar 是否通过筛选
        const passFilter = (avatar) => {
            if (isFilteringByGroup) return true;
            if (state.filter === 'bound' && !isBound(avatar)) return false;
            if (state.filter === 'unbound' && isBound(avatar)) return false;
            return true;
        };

        // 簇是否通过筛选（已绑定=任一变体已绑定；未绑定=全部未绑定）
        const passFilterCluster = (avatars) => {
            if (isFilteringByGroup) return true;
            if (state.filter === 'bound') return avatars.some(isBound);
            if (state.filter === 'unbound') return avatars.every(a => !isBound(a));
            return true;
        };

        const groups = getGroups();
        const groupedSet = new Set();
        for (const g of groups) g.personas.forEach(a => groupedSet.add(a));
        const allAvatars = getAllAvatars().filter(a => cardMap.has(a));
        const ungroupedAvatars = allAvatars.filter(a => !groupedSet.has(a));

        let pageItemsForDisplay = []; // 仅用于"未分组区"的分页展示，存的是要显示的代表 avatar
        let totalPages = 1;

        if (isFilteringByGroup) {
            // 单分组筛选：在该分组内做合并/分页
            const targetGroup = groups.find(g => g.id === filterGroupId);
            let groupAvatars = targetGroup
                ? targetGroup.personas.filter(a => cardMap.has(a))
                : [];

            if (merge) {
                // 合并：把组内同名的折叠成代表，但变体仅取本组内的
                groupAvatars = collapseToRepresentatives(groupAvatars);
            }

            const pageSize = getPageSize();
            totalPages = Math.max(1, Math.ceil(groupAvatars.length / pageSize));
            if (state.page >= totalPages) state.page = totalPages - 1;
            if (state.page < 0) state.page = 0;
            const start = state.page * pageSize;
            pageItemsForDisplay = groupAvatars.slice(start, start + pageSize);
        } else {
            // 全局视图：未分组区 + 各分组区
            let ungroupedFiltered;
            if (merge) {
                // 合并：先按名字分簇，整簇通过筛选才显示，并以代表展示
                const reps = collapseToRepresentatives(ungroupedAvatars);
                ungroupedFiltered = reps.filter(rep => {
                    const name = getName(rep);
                    const variants = getVariantsOfName(name, ungroupedAvatars);
                    return passFilterCluster(variants);
                });
            } else {
                ungroupedFiltered = ungroupedAvatars.filter(passFilter);
            }
            const pageSize = getPageSize();
            totalPages = Math.max(1, Math.ceil(ungroupedFiltered.length / pageSize));
            if (state.page >= totalPages) state.page = totalPages - 1;
            if (state.page < 0) state.page = 0;
            const start = state.page * pageSize;
            pageItemsForDisplay = ungroupedFiltered.slice(start, start + pageSize);

            if (!hidden) {
                const fragmentsToPrepend = [];
                for (const g of groups) {
                    let groupCards = g.personas.filter(a => cardMap.has(a));
                    const totalPersonasInGroup = groupCards.length;

                    let visibleItems; // 通过筛选后真正要显示的 "代表 avatar" 列表（合并模式）或普通 avatar 列表
                    if (merge) {
                        const reps = collapseToRepresentatives(groupCards);
                        visibleItems = reps.filter(rep => {
                            const name = getName(rep);
                            const variants = getVariantsOfName(name, groupCards);
                            return passFilterCluster(variants);
                        });
                    } else {
                        visibleItems = groupCards.filter(passFilter);
                    }

                    if (totalPersonasInGroup > 0 && visibleItems.length === 0) continue;

                    const wrapper = document.createElement('div');
                    wrapper.className = 'pg-group-wrapper' + (g.collapsed ? ' pg-collapsed' : '');
                    if (totalPersonasInGroup === 0) wrapper.classList.add('pg-empty');
                    wrapper.dataset.gid = g.id;

                    const header = document.createElement('div');
                    header.className = 'pg-group-header';
                    const countText = totalPersonasInGroup === 0 ? '空' : visibleItems.length;
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
                        for (const rep of visibleItems) {
                            const card = cardMap.get(rep);
                            if (!card) continue;
                            card.style.display = '';
                            body.appendChild(card);

                            if (merge) {
                                const name = getName(rep);
                                const variants = getVariantsOfName(name, groupCards);
                                if (variants.length > 1) {
                                    decorateRepresentative(card, name, variants.length);
                                    if (isClusterExpanded(name)) {
                                        const drawer = buildVariantDrawer(name, variants, cardMap);
                                        body.appendChild(drawer);
                                    }
                                } else {
                                    undecorateRepresentative(card);
                                }
                            } else {
                                undecorateRepresentative(card);
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
        }

        // 渲染未分组区（或筛选分组的当前页）
        for (const rep of pageItemsForDisplay) {
            const card = cardMap.get(rep);
            if (!card) continue;
            card.style.display = '';
            block.appendChild(card);

            if (merge) {
                const name = getName(rep);
                let scope;
                if (isFilteringByGroup) {
                    const targetGroup = groups.find(g => g.id === filterGroupId);
                    scope = targetGroup ? targetGroup.personas.filter(a => cardMap.has(a)) : [];
                } else {
                    scope = ungroupedAvatars;
                }
                const variants = getVariantsOfName(name, scope);
                if (variants.length > 1) {
                    decorateRepresentative(card, name, variants.length);
                    if (isClusterExpanded(name)) {
                        const drawer = buildVariantDrawer(name, variants, cardMap);
                        block.appendChild(drawer);
                    }
                } else {
                    undecorateRepresentative(card);
                }
            } else {
                undecorateRepresentative(card);
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
 * 把所有自定义 DOM（分组容器、变体抽屉、提示）拆掉，把卡片放回 block 顶层。
 */
function cleanupCustomDom(block) {
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
    block.querySelectorAll('.pg-variant-drawer').forEach(el => el.remove());
    // 清掉残留的徽章
    block.querySelectorAll('.pg-cluster-badge').forEach(el => el.remove());
    block.querySelectorAll('.avatar-container.pg-cluster-rep').forEach(c => c.classList.remove('pg-cluster-rep', 'pg-cluster-expanded'));
}

/**
 * 给代表卡加 "× N" 徽章
 */
function decorateRepresentative(card, name, count) {
    card.classList.add('pg-cluster-rep');
    if (isClusterExpanded(name)) card.classList.add('pg-cluster-expanded');
    else card.classList.remove('pg-cluster-expanded');

    let badge = card.querySelector(':scope > .pg-cluster-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'pg-cluster-badge';
        badge.title = '展开 / 收起 同名变体';
        card.appendChild(badge);
    }
    badge.dataset.cname = name;
    badge.innerHTML = '<i class="fa-solid fa-layer-group"></i><span>×' + count + '</span>';

    if (!badge.dataset.pgBound) {
        badge.dataset.pgBound = '1';
        badge.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            const n = badge.dataset.cname;
            toggleClusterExpand(n);
            refreshMain();
        });
    }
}

function undecorateRepresentative(card) {
    card.classList.remove('pg-cluster-rep', 'pg-cluster-expanded');
    const badge = card.querySelector(':scope > .pg-cluster-badge');
    if (badge) badge.remove();
}

/**
 * 构建变体抽屉（无头像列表）
 */
function buildVariantDrawer(name, variants, cardMap) {
    const drawer = document.createElement('div');
    drawer.className = 'pg-variant-drawer';
    drawer.dataset.cname = name;

    const list = document.createElement('div');
    list.className = 'pg-variant-list';

    for (const a of variants) {
        const item = document.createElement('div');
        item.className = 'pg-variant-item';
        item.dataset.avatar = a;
        if (isCurrent(a)) item.classList.add('pg-current');
        if (isBound(a)) item.classList.add('pg-bound');

        const title = getTitle(a);
        const desc = getDescription(a);
        const subtitle = title || (desc ? desc.replace(/\s+/g, ' ').slice(0, 30) + (desc.length > 30 ? '…' : '') : '(无备注 / 无描述)');

        item.innerHTML =
            '<div class="pg-variant-main">' +
              '<span class="pg-variant-name">' + esc(name) + '</span>' +
              '<span class="pg-variant-sub">' + esc(subtitle) + '</span>' +
            '</div>' +
            '<div class="pg-variant-tags">' +
              (isBound(a) ? '<span class="pg-variant-tag pg-tag-bound" title="已绑定"><i class="fa-solid fa-link"></i></span>' : '') +
              (isCurrent(a) ? '<span class="pg-variant-tag pg-tag-current" title="当前">★</span>' : '') +
            '</div>';

        item.addEventListener('click', async e => {
            e.preventDefault();
            e.stopPropagation();
            await switchPersona(a);
            // 立即更新 UI 反馈
            list.querySelectorAll('.pg-variant-item.pg-current').forEach(x => x.classList.remove('pg-current'));
            item.classList.add('pg-current');
            setTimeout(updateQuickBtnAvatar, 50);
        });

        list.appendChild(item);
    }
    drawer.appendChild(list);
    return drawer;
}

async function ensureAllCardsInDom() {
    const block = document.getElementById('user_avatar_block');
    if (!block) return;

    const allAvatars = getAllAvatars();

    const presentInDom = new Set();
    block.querySelectorAll(':scope > .avatar-container').forEach(c => {
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
        const id = getCardAvatarId(c);
        if (id) presentAfter.add(id);
    });
    const stillMissing = allAvatars.filter(a => !presentAfter.has(a));
    if (stillMissing.length === 0) return;

    const template = block.querySelector(':scope > .avatar-container');
    if (!template) return;

    for (const avatar of stillMissing) {
        const clone = template.cloneNode(true);
        clone.classList.remove('selected', 'pg-cluster-rep', 'pg-cluster-expanded');
        // 清掉模板可能带来的徽章
        clone.querySelectorAll('.pg-cluster-badge').forEach(el => el.remove());

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
            // 点徽章不触发切换
            if (e.target.closest('.pg-cluster-badge')) return;
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

    block.querySelectorAll('.avatar-container').forEach(c => {
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

// ========== 位置2：快捷弹窗 ==========
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
    return '<div class="pg-quick-avatar' + (isCurrent(a)?' pg-current':'') + '" data-avatar="' + esc(a) + '" title="' + esc(getName(a)) + '"><img src="' + getAvatarUrl(a) + '"></div>';
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
