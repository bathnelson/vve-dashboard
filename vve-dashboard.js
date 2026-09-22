// VvE Dashboard Haarlem — applicatielogica
// Gegenereerd uit vve_dashboard.html. Data komt uit losse bestanden naast de HTML.

// ============================================
        // CRM SYSTEEM MET FILE SYSTEM ACCESS API
        // ============================================

        // CRM Status opties - Power Apps style colors
        const CRM_STATUSES = [
            { key: 'nieuw', label: 'Nieuw', color: 'bg-pa-gray-100 text-pa-gray-700' },
            { key: 'eerste_contact', label: 'Eerste contact', color: 'bg-pa-blue-100 text-pa-blue-700' },
            { key: 'in_gesprek', label: 'In gesprek', color: 'bg-pa-purple-100 text-pa-purple-700' },
            { key: 'actief_project', label: 'Actief project', color: 'bg-green-100 text-green-700' },
            { key: 'afgerond', label: 'Afgerond', color: 'bg-emerald-100 text-emerald-700' },
            { key: 'niet_geinteresseerd', label: 'Niet geïnteresseerd', color: 'bg-red-100 text-red-700' }
        ];

        const CRM_PRIORITIES = [
            { key: 'hoog', label: 'Hoog', color: 'bg-red-100 text-red-700' },
            { key: 'normaal', label: 'Normaal', color: 'bg-pa-gray-100 text-pa-gray-700' },
            { key: 'laag', label: 'Laag', color: 'bg-pa-blue-100 text-pa-blue-700' }
        ];

        const CONTACT_TYPES = [
            { key: 'email', label: 'Email', icon: '✉️' },
            { key: 'telefoon', label: 'Telefoon', icon: '📞' },
            { key: 'bezoek', label: 'Bezoek', icon: '🏠' },
            { key: 'vergadering', label: 'Vergadering', icon: '👥' },
            { key: 'notitie', label: 'Notitie', icon: '📝' }
        ];

        // Teamleden (kan later uitgebreid worden)
        // TEAM_MEMBERS komt uit team_config.js naast de HTML; fallback als dat ontbreekt
        if (typeof TEAM_MEMBERS === 'undefined') {
            window.TEAM_MEMBERS = ['Gemeente Haarlem', 'Extern adviseur'];
        }

        // CRM File Handle (voor File System Access API)
        let crmFileHandle = null;
        let crmData = { vves: {}, meta: { lastModified: null, lastModifiedBy: null } };

        // File System Access API functies
        const selectCrmFile = async () => {
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'JSON bestanden',
                        accept: { 'application/json': ['.json'] }
                    }],
                    multiple: false
                });
                crmFileHandle = handle;
                await loadCrmFromFile();
                return true;
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error('Fout bij selecteren bestand:', e);
                }
                return false;
            }
        };

        const createNewCrmFile = async () => {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'vve_crm_data.json',
                    types: [{
                        description: 'JSON bestanden',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                crmFileHandle = handle;
                crmData = {
                    vves: {},
                    meta: {
                        created: new Date().toISOString(),
                        lastModified: new Date().toISOString(),
                        lastModifiedBy: null
                    }
                };
                await saveCrmToFile();
                return true;
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error('Fout bij aanmaken bestand:', e);
                }
                return false;
            }
        };

        const loadCrmFromFile = async () => {
            if (!crmFileHandle) return false;
            try {
                const file = await crmFileHandle.getFile();
                const text = await file.text();
                crmData = JSON.parse(text);
                // Ensure structure exists
                if (!crmData.vves) crmData.vves = {};
                if (!crmData.meta) crmData.meta = {};
                return true;
            } catch (e) {
                console.error('Fout bij laden CRM bestand:', e);
                return false;
            }
        };

        const saveCrmToFile = async () => {
            if (!crmFileHandle) return false;
            try {
                const writable = await crmFileHandle.createWritable();
                crmData.meta.lastModified = new Date().toISOString();
                await writable.write(JSON.stringify(crmData, null, 2));
                await writable.close();
                return true;
            } catch (e) {
                console.error('Fout bij opslaan CRM bestand:', e);
                return false;
            }
        };

        // CRM data functies
        const getCrmForVve = (vveId) => {
            return crmData.vves[vveId] || null;
        };

        const setCrmForVve = async (vveId, data) => {
            crmData.vves[vveId] = {
                ...data,
                lastModified: new Date().toISOString()
            };
            if (crmFileHandle) {
                await saveCrmToFile();
            }
        };

        const addContactMoment = async (vveId, contact) => {
            if (!crmData.vves[vveId]) {
                crmData.vves[vveId] = {
                    status: 'nieuw',
                    prioriteit: 'normaal',
                    toegewezenAan: '',
                    volgendeActie: '',
                    volgendeActieDeadline: '',
                    contactmomenten: []
                };
            }
            crmData.vves[vveId].contactmomenten = crmData.vves[vveId].contactmomenten || [];
            crmData.vves[vveId].contactmomenten.unshift({
                ...contact,
                id: Date.now(),
                timestamp: new Date().toISOString()
            });
            crmData.vves[vveId].lastModified = new Date().toISOString();
            if (crmFileHandle) {
                await saveCrmToFile();
            }
        };

        const deleteContactMoment = async (vveId, contactId) => {
            if (crmData.vves[vveId]?.contactmomenten) {
                crmData.vves[vveId].contactmomenten = crmData.vves[vveId].contactmomenten.filter(c => c.id !== contactId);
                crmData.vves[vveId].lastModified = new Date().toISOString();
                if (crmFileHandle) {
                    await saveCrmToFile();
                }
            }
        };

        // ============================================
        // VERRIJKTE DATA (LOKAAL)
        // ============================================

        // LocalStorage key voor verrijkte VvE data
        const VVE_ENRICHMENT_KEY = 'vve_enrichment_data';

        // Verrijkte VvE data laden uit LocalStorage
        // Bij eerste keer: merge KVK_HANDMATIG (uit kvk_handmatig.txt) in localStorage
        const _mergeHandmatigeKvk = () => {
            try {
                if (typeof KVK_HANDMATIG === 'undefined' || !KVK_HANDMATIG) return;
                const stored = localStorage.getItem(VVE_ENRICHMENT_KEY);
                const existing = stored ? JSON.parse(stored) : {};
                let merged = 0;
                Object.entries(KVK_HANDMATIG).forEach(([vveId, kvkNummer]) => {
                    if (!existing[vveId]) existing[vveId] = {};
                    if (!existing[vveId].kvkNummer) {
                        existing[vveId].kvkNummer = kvkNummer;
                        existing[vveId].lastModified = existing[vveId].lastModified || new Date().toISOString();
                        merged++;
                    }
                });
                if (merged > 0) {
                    localStorage.setItem(VVE_ENRICHMENT_KEY, JSON.stringify(existing));
                    console.log(`KVK_HANDMATIG: ${merged} nummers geïmporteerd`);
                }
                window.KVK_HANDMATIG = {}; // na merge uit geheugen wissen
            } catch (e) { console.error('Fout bij mergen KVK_HANDMATIG:', e); }
        };
        _mergeHandmatigeKvk();

        const loadEnrichmentData = () => {
            // Als de multi-user cache geladen is, gebruik die
            if (_mergedEnrichCache !== null) return _mergedEnrichCache;
            try {
                const stored = localStorage.getItem(VVE_ENRICHMENT_KEY);
                return stored ? JSON.parse(stored) : {};
            } catch (e) {
                console.error('Fout bij laden verrijkte data:', e);
                return {};
            }
        };

        // Verrijkte VvE data opslaan in LocalStorage
        const saveEnrichmentData = (data) => {
            try {
                localStorage.setItem(VVE_ENRICHMENT_KEY, JSON.stringify(data));
            } catch (e) {
                console.error('Fout bij opslaan verrijkte data:', e);
            }
        };

        // Verrijkte data voor specifieke VvE ophalen
        const getVveEnrichment = (vveId) => {
            // Bestandsdata (vve_dossier_data.js) vormt de basis; localStorage overschrijft (handmatige edits winnen)
            const fileEntry  = (typeof VVE_DOSSIER_DATA !== 'undefined' && VVE_DOSSIER_DATA[vveId]) || {};
            const localEntry = loadEnrichmentData()[vveId] || {};
            const merged = { ...fileEntry, ...localEntry };
            return Object.keys(merged).length > 0 ? merged : null;
        };

        // ============================================
        // MULTI-USER VERRIJKINGSSYSTEEM
        // ============================================

        // Multi-user enrichment state
        let _currentUserEnrichData = { data: {}, log: [] }; // in-memory voor huidige gebruiker
        let _mergedEnrichCache = null; // null = niet geladen, {} = leeg, {...} = geladen

        // Helper: huidige gebruikersnaam ophalen
        const _getCurrentUser = () => localStorage.getItem('vve_dashboard_username') || '';

        // Verrijkte data voor specifieke VvE opslaan (met logging + cache-update)
        const setVveEnrichment = (vveId, enrichment) => {
            // Vergelijk nieuwe waarden met huidige en log gewijzigde velden
            const oldData = loadEnrichmentData()[vveId] || {};
            const fieldsToLog = ['nickname','adviestraject','bureau','intake','procesbegeleider','mwa','verdieping','uitvoering','notities','beheerder','kvkNummer',
                'bestuurNaam','bestuurEmail','bestuurTelefoon','duurzaamheidNaam','duurzaamheidEmail','duurzaamheidTelefoon'];
            const user = _getCurrentUser();
            const ts = Date.now();

            if (enrichment) {
                // Zoek VvE-naam via window.groupedByVve (beschikbaar als React al geladen is)
                let vveNaam = vveId;
                try {
                    if (typeof VVE_DATA !== 'undefined') {
                        const found = VVE_DATA.find(d => d.vve_identificatie === vveId);
                        if (found) vveNaam = found.statutairenaam || vveId;
                    }
                } catch(e) {}

                fieldsToLog.forEach(field => {
                    const oldVal = oldData[field] || '';
                    const newVal = enrichment[field] || '';
                    if (oldVal !== newVal) {
                        _currentUserEnrichData.log.push({ ts, user, vve_id: vveId, vve_naam: vveNaam, field, old: oldVal, new: newVal });
                        if (!_currentUserEnrichData.data[vveId]) _currentUserEnrichData.data[vveId] = {};
                        _currentUserEnrichData.data[vveId][field] = { v: newVal, ts };
                    }
                });
            }

            // Bewaar in localStorage (bestaand gedrag)
            const allData = loadEnrichmentData();
            if (enrichment && Object.values(enrichment).some(v => v && v.trim && v.trim() !== '')) {
                allData[vveId] = { ...enrichment, lastModified: new Date().toISOString() };
            } else {
                delete allData[vveId];
            }
            saveEnrichmentData(allData);

            // Update _mergedEnrichCache direct (geen volledige hermerge)
            if (_mergedEnrichCache !== null) {
                if (enrichment && Object.values(enrichment).some(v => v && v.trim && v.trim() !== '')) {
                    _mergedEnrichCache[vveId] = { ...(_mergedEnrichCache[vveId] || {}), ...enrichment };
                } else {
                    delete _mergedEnrichCache[vveId];
                }
            }

            // Markeer dirty (via custom event zodat React state update mogelijk is)
            window.dispatchEvent(new CustomEvent('enrichmentDirty'));
        };

        // Laad alle enrichment_*.json bestanden uit de gekoppelde map en merge tot cache
        const loadUserEnrichmentFiles = async (dirHandle) => {
            const allUserData = {};
            try {
                for await (const [name, handle] of dirHandle.entries()) {
                    if (!name.startsWith('enrichment_') || !name.endsWith('.json') || name === 'enrichment_manifest.json') continue;
                    try {
                        const file = await handle.getFile();
                        const parsed = JSON.parse(await file.text());
                        if (parsed?.meta?.user) allUserData[parsed.meta.user] = parsed;
                    } catch(e) { console.warn('Kon enrichment bestand niet laden:', name, e); }
                }
            } catch(e) { console.warn('Fout bij scannen enrichment bestanden:', e); }

            // Merge: last ts wins per field per vveId
            const merged = {};
            for (const [user, ud] of Object.entries(allUserData)) {
                for (const [vveId, fields] of Object.entries(ud.data || {})) {
                    if (!merged[vveId]) merged[vveId] = {};
                    for (const [field, entry] of Object.entries(fields)) {
                        if (!merged[vveId][field] || entry.ts > merged[vveId][field].ts) {
                            merged[vveId][field] = { ...entry, user };
                        }
                    }
                }
            }

            // Sla huidige gebruiker's data op in _currentUserEnrichData
            const curUser = _getCurrentUser();
            if (curUser && allUserData[curUser]) {
                _currentUserEnrichData.data = allUserData[curUser].data || {};
                _currentUserEnrichData.log = allUserData[curUser].log || [];
            }

            // Vlak maken voor compatibiliteit
            const flat = {};
            for (const [vveId, fields] of Object.entries(merged)) {
                flat[vveId] = {};
                for (const [field, entry] of Object.entries(fields)) {
                    if (entry.v !== undefined && entry.v !== '') flat[vveId][field] = entry.v;
                }
            }

            // localStorage (huidige werkversie) wint altijd
            const local = (() => { try { return JSON.parse(localStorage.getItem('vve_enrichment_data') || '{}'); } catch(e) { return {}; } })();
            for (const [vveId, entry] of Object.entries(local)) {
                flat[vveId] = { ...(flat[vveId] || {}), ...entry };
            }
            _mergedEnrichCache = flat;
            return Object.keys(allUserData);
        };

        // Schrijf enrichment_[username].json naar de gekoppelde map
        const saveUserEnrichmentFile = async (dirHandle) => {
            const username = _getCurrentUser();
            if (!username) throw new Error('Geen gebruikersnaam ingesteld');
            const payload = {
                meta: { user: username, saved: new Date().toISOString(), version: 1 },
                data: _currentUserEnrichData.data,
                log: _currentUserEnrichData.log,
            };
            const filename = `enrichment_${username}.json`;
            const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(payload, null, 2));
            await writable.close();
            return filename;
        };

        // Consolideer alle enrichment files tot één enrichment_consolidated.json (admin)
        const consolidateEnrichmentFiles = async (dirHandle) => {
            const users = await loadUserEnrichmentFiles(dirHandle);
            // Bouw gecombineerde log: lees alle user-files opnieuw voor de logs
            const combinedLog = [];
            try {
                for await (const [name, handle] of dirHandle.entries()) {
                    if (!name.startsWith('enrichment_') || !name.endsWith('.json') || name === 'enrichment_manifest.json' || name === 'enrichment_consolidated.json') continue;
                    try {
                        const file = await handle.getFile();
                        const parsed = JSON.parse(await file.text());
                        if (Array.isArray(parsed?.log)) combinedLog.push(...parsed.log);
                    } catch(e) {}
                }
            } catch(e) {}
            combinedLog.sort((a, b) => a.ts - b.ts);

            const payload = {
                meta: { consolidated: new Date().toISOString(), users: users.length, version: 1 },
                data: _mergedEnrichCache || {},
                log: combinedLog,
            };
            const fileHandle = await dirHandle.getFileHandle('enrichment_consolidated.json', { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(payload, null, 2));
            await writable.close();
            return { users: users.length, logEntries: combinedLog.length, vves: Object.keys(payload.data).length };
        };

        // IndexedDB helpers — sla FileSystemDirectoryHandle op zodat de mapkoppeling
        // na een paginaherlaad automatisch hersteld wordt (localStorage kan geen handles opslaan).
        const _idbOpen = () => new Promise((resolve, reject) => {
            const req = indexedDB.open('vve_dashboard_fs', 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
            req.onsuccess  = e => resolve(e.target.result);
            req.onerror    = ()  => reject(req.error);
        });
        const idbGet = async (key) => {
            const db = await _idbOpen();
            return new Promise((resolve, reject) => {
                const req = db.transaction('handles').objectStore('handles').get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror   = () => reject(req.error);
            });
        };
        const idbSet = async (key, val) => {
            const db = await _idbOpen();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(val, key);
                tx.oncomplete = resolve;
                tx.onerror    = () => reject(tx.error);
            });
        };
        const idbDel = async (key) => {
            const db = await _idbOpen();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('handles', 'readwrite');
                tx.objectStore('handles').delete(key);
                tx.oncomplete = resolve;
                tx.onerror    = () => reject(tx.error);
            });
        };

        // Exporteer alle verrijkte data als JSON
        const exportEnrichmentData = () => {
            const data = loadEnrichmentData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `vve_verrijkte_data_${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
        };

        // Exporteer handmatige KvK nummers als kvk_handmatig.txt (JSON)
        // Alleen entries die nog NIET in kvk_lookup.js zitten (echt nieuwe nummers)
        const exportKvkHandmatigJs = () => {
            const allData = loadEnrichmentData();
            const kvkEntries = {};
            Object.entries(allData).forEach(([vveId, enr]) => {
                if (enr?.kvkNummer && !lookupKvkNummer(vveId)) kvkEntries[vveId] = enr.kvkNummer;
            });
            const count = Object.keys(kvkEntries).length;
            if (count === 0) return 0;
            const blob = new Blob([JSON.stringify(kvkEntries, null, 2) + '\n'], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'kvk_handmatig.txt';
            link.click();
            URL.revokeObjectURL(url);
            return count;
        };

        const exportVerdachteVves = () => {
            const seen = new Set();
            const rows = VVE_DATA.filter(d => d._verdacht && !seen.has(d.vve_identificatie) && seen.add(d.vve_identificatie))
                .sort((a, b) => (b._werkelijk_aantal - b._brondata_aantal) - (a._werkelijk_aantal - a._brondata_aantal));
            if (rows.length === 0) return 0;
            const header = 'vve_identificatie,statutairenaam,brondata_aantal,werkelijk_aantal,verschil,buurt,wijk';
            const csv = [header, ...rows.map(d => [
                d.vve_identificatie,
                '"' + (d.statutairenaam || '').replace(/"/g, '""') + '"',
                d._brondata_aantal,
                d._werkelijk_aantal,
                d._werkelijk_aantal - d._brondata_aantal,
                '"' + (d.buurt || '') + '"',
                '"' + (d.wijk || '') + '"'
            ].join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'verdachte_vves.csv';
            link.click();
            URL.revokeObjectURL(url);
            return rows.length;
        };

        // Handmatig gecontroleerde KvK-nummers (kvk_correcties.js) gaan voor op
        // vve_data.js en kvk_lookup.js. Een lege waarde betekent: geen KvK-nummer.
        (function pasKvkCorrectiesToe() {
            if (typeof KVK_CORRECTIES === 'undefined') return;
            if (typeof VVE_DATA !== 'undefined') VVE_DATA.forEach(item => {
                if (Object.prototype.hasOwnProperty.call(KVK_CORRECTIES, item.vve_identificatie)) item.kvknummer = KVK_CORRECTIES[item.vve_identificatie] || '';
            });
            if (typeof KVK_LOOKUP !== 'undefined') Object.keys(KVK_CORRECTIES).forEach(vveId => { delete KVK_LOOKUP[vveId]; });
        })();

        // KvK lookup uit alternatieve dataset (vve_haarlem.csv)
        const lookupKvkNummer = (vveId) => {
            if (!vveId || typeof KVK_LOOKUP === 'undefined') return null;
            return KVK_LOOKUP[vveId] || null;
        };

        // KvK bron bepalen: 'eigen' (groen), 'lookup' (oranje), 'handmatig' (rood), of null
        const getKvkSource = (item, enrichment) => {
            if (item.kvknummer) return 'eigen';
            if (lookupKvkNummer(item.vve_identificatie)) return 'lookup';
            if (enrichment?.kvkNummer) return 'handmatig';
            return null;
        };
        const getKvkNummer = (item, enrichment) => {
            return item.kvknummer || lookupKvkNummer(item.vve_identificatie) || enrichment?.kvkNummer || null;
        };
        const kvkSourceColor = { eigen: 'text-green-600', lookup: 'text-orange-500', handmatig: 'text-red-500' };
        const kvkSourceBg = { eigen: 'bg-green-50 border-green-200', lookup: 'bg-orange-50 border-orange-200', handmatig: 'bg-red-50 border-red-200' };
        const kvkSourceLabel = { eigen: 'Eigen dataset', lookup: 'Alternatieve lijst', handmatig: 'Handmatig opgezocht' };

        // Beschermd stadsgezicht lookup op vve_identificatie
        const getBeschermdGezicht = (vveId) => {
            if (!vveId || typeof BESCHERMD_GEZICHT === 'undefined') return null;
            return BESCHERMD_GEZICHT[vveId] || null;
        };


        // Functie om warmte data op te halen voor een buurt (met fuzzy matching)
        // ── Warmteprogramma op pandniveau (bron: pandid_warmteprogramma.js) ──
        const getWarmteProg = (item) => {
            if (!item) return null;
            const pid = item.gerelateerd_pand_id;
            if (!pid || typeof getWarmteprogramma !== 'function') return null;
            // gerelateerd_pand_id kan meerdere id's bevatten ("id1,id2")
            if (pid.indexOf(',') === -1) return getWarmteprogramma(pid);
            for (const part of pid.split(',')) {
                const hit = getWarmteprogramma(part.trim());
                if (hit) return hit;
            }
            return null;
        };

        // Buurt-aggregaat voor de kaartlaag: meest voorkomende warmtevoorziening
        // en tijdvak binnen de buurt, afgeleid uit de panddata.
        let _buurtWarmteCache = null;
        const getWarmteData = (buurt) => {
            if (!buurt) return null;
            if (!_buurtWarmteCache) {
                _buurtWarmteCache = {};
                const acc = {};
                const rows = (typeof VVE_DATA !== 'undefined') ? VVE_DATA : [];
                rows.forEach(it => {
                    const wp = getWarmteProg(it);
                    if (!wp || !it.buurt) return;
                    const b = it.buurt.trim();
                    if (!acc[b]) acc[b] = { w: {}, t: {} };
                    acc[b].w[wp.warmte] = (acc[b].w[wp.warmte] || 0) + 1;
                    acc[b].t[wp.tijdvak] = (acc[b].t[wp.tijdvak] || 0) + 1;
                });
                const top = o => Object.keys(o).sort((x, y) => o[y] - o[x])[0] || null;
                Object.keys(acc).forEach(b => {
                    _buurtWarmteCache[b.toLowerCase()] = {
                        wijk: null,
                        wijkwarmteplan: top(acc[b].t),
                        warmtevoorziening: top(acc[b].w)
                    };
                });
            }
            return _buurtWarmteCache[buurt.trim().toLowerCase()] || null;
        };


        // ── Ligging-benadering (obv BAG-velden, geen externe geometrie) ──────
        // basiseenheidtype-waarden die op onverwarmde ruimte duiden
        const ONVERWARMD_TYPES = new Set(['garage(box)', 'berging/opslag', 'trafo', 'technische ruimte']);

        // Hex-kleuren die overeenkomen met de .energy-X CSS-klassen, voor gebruik in SVG
        const getEnergyHex = (label) => {
            if (!label || label === '-') return '#d1d5db';
            if (label.startsWith('A')) return '#22c55e';
            if (label === 'B') return '#84cc16';
            if (label === 'C') return '#eab308';
            if (label === 'D') return '#f97316';
            if (label === 'E') return '#ef4444';
            if (label === 'F') return '#dc2626';
            if (label === 'G') return '#991b1b';
            return '#d1d5db';
        };

        const getPandUnits = (pandId) => {
            if (!pandId || typeof VVE_DATA === 'undefined') return [];
            return VVE_DATA.filter(d => d.gerelateerd_pand_id === pandId);
        };

        const sortUnitsInFloor = (units) => [...units].sort((a, b) => {
            const numA = parseInt(a.huisnummer) || 0, numB = parseInt(b.huisnummer) || 0;
            if (numA !== numB) return numA - numB;
            const letterA = (a.huisletter || '').toLowerCase(), letterB = (b.huisletter || '').toLowerCase();
            if (letterA !== letterB) return letterA.localeCompare(letterB);
            return (a.huisnummertoevoeging || '').toLowerCase().localeCompare((b.huisnummertoevoeging || '').toLowerCase());
        });

        // Benadert de ligging van een adres binnen zijn pand: onder het dak, boven onverwarmde
        // ruimte, begane grond, en (waar de BAG dit direct classificeert) hoekwoning.
        // Bij appartementen zonder directe hoek-classificatie wordt een lage-betrouwbaarheid
        // indicatie gegeven op basis van adresvolgorde binnen de bouwlaag — expliciet als
        // 'indicatief' gemarkeerd, want dit is een aanname, geen brondata.
        const getLiggingInfo = (item) => {
            if (!item || !item.gerelateerd_pand_id) return null;
            const pandUnits = getPandUnits(item.gerelateerd_pand_id);
            const withBouwlaag = pandUnits.filter(u => u.hoogste_bouwlaag != null && u.laagste_bouwlaag != null);
            if (withBouwlaag.length === 0 || item.hoogste_bouwlaag == null || item.laagste_bouwlaag == null) {
                return { pandUnits, floors: null };
            }

            const pandMax = Math.max(...withBouwlaag.map(u => u.hoogste_bouwlaag));
            const pandMin = Math.min(...withBouwlaag.map(u => u.laagste_bouwlaag));
            const onderDak = item.hoogste_bouwlaag === pandMax;
            const beganeGrond = item.laagste_bouwlaag === pandMin;

            const onverwarmdOnder = withBouwlaag.filter(u => ONVERWARMD_TYPES.has(u.basiseenheidtype) && u.hoogste_bouwlaag === item.laagste_bouwlaag - 1);
            const bovenOnverwarmd = onverwarmdOnder.length > 0;

            const hoekDirect = item.basiseenheidtype === 'woning (hoek)';
            const vrijstaandDirect = item.basiseenheidtype === 'woning (vrijstaand)' || item.basiseenheidtype === 'woning (2 ^ 1 kap)';

            let indicatieveKopseGevel = false;
            if (!hoekDirect && !vrijstaandDirect) {
                const floorMates = sortUnitsInFloor(withBouwlaag.filter(u => u.hoogste_bouwlaag === item.hoogste_bouwlaag));
                if (floorMates.length > 1) {
                    const idx = floorMates.findIndex(u => u.verblijfsobject_id === item.verblijfsobject_id);
                    indicatieveKopseGevel = idx === 0 || idx === floorMates.length - 1;
                }
            }

            // Rijen voor het schema: gegroepeerd op hoogste_bouwlaag (top naar beneden)
            const floorNumbers = [...new Set(withBouwlaag.map(u => u.hoogste_bouwlaag))].sort((a, b) => b - a);
            const floors = floorNumbers.map(f => ({
                nummer: f,
                units: sortUnitsInFloor(withBouwlaag.filter(u => u.hoogste_bouwlaag === f))
            }));

            return {
                pandUnits, pandMax, pandMin, onderDak, beganeGrond, bovenOnverwarmd, onverwarmdOnder,
                hoekDirect, vrijstaandDirect, indicatieveKopseGevel, floors
            };
        };

/* ═══════════════ hoofdapplicatie ═══════════════ */

function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
var _React = React,
  useState = _React.useState,
  useMemo = _React.useMemo,
  useCallback = _React.useCallback,
  useEffect = _React.useEffect,
  useRef = _React.useRef,
  useDeferredValue = _React.useDeferredValue;

// === Build & Versioning ===
var APP_BUILD = 12;
// 'e' achter het buildnummer zodra de code extern geladen is (GitHub Pages)
// in plaats van naast de HTML.
// Mapnaam per VvE uit vve_mapnamen.js (lokaal). Zonder dat bestand geen kolom.
var MAPNAMEN_AAN = typeof VVE_MAPNAMEN !== 'undefined';
var getMapnaam = vveId => MAPNAMEN_AAN && VVE_MAPNAMEN[vveId] || '';
// Link naar de VvE-map; de locatie komt uit DOSSIER_BASIS in team_config.js (lokaal).
// Mini-VvE's (VVE_MINI uit vve_mapnamen.js) staan op een eigen locatie: DOSSIER_BASIS.mini,
// met als standaard de submap _mini's in dezelfde bibliotheek.
var _miniSet = null;
var isMiniVve = vveId => {
  if (_miniSet === null) _miniSet = new Set(typeof VVE_MINI !== 'undefined' ? VVE_MINI : []);
  return _miniSet.has(vveId);
};
var dossierLocatie = vveId => {
  if (typeof DOSSIER_BASIS === 'undefined' || !DOSSIER_BASIS || !DOSSIER_BASIS.site) return null;
  var b = DOSSIER_BASIS;
  if (!isMiniVve(vveId)) return { site: b.site, bibliotheek: b.bibliotheek, map: b.map || '' };
  var m = b.mini || {};
  return {
    site: m.site || b.site,
    bibliotheek: m.bibliotheek || b.bibliotheek,
    map: Object.prototype.hasOwnProperty.call(m, 'map') ? m.map || '' : "_mini's"
  };
};
var dossierUrl = vveId => {
  var naam = getMapnaam(vveId);
  var loc = naam && dossierLocatie(vveId);
  if (!loc) return '';
  try {
    var site = String(loc.site).replace(/\/+$/, '');
    var bib = String(loc.bibliotheek || '').replace(/^\/+|\/+$/g, '');
    var sub = String(loc.map || '').replace(/^\/+|\/+$/g, '');
    var pad = new URL(site).pathname.replace(/\/+$/, '') + '/' + bib + (sub ? '/' + sub : '') + '/' + naam;
    return site + '/' + bib + '/Forms/AllItems.aspx?id=' + encodeURIComponent(pad);
  } catch (err) { return ''; }
};
// Hoofdsplitsing: de VvE bestaat uit een paar grote rechten die elk weer
// onderverdeeld zijn; de onderverenigingen staan niet in de data. Benadering:
// het staat in de naam, of er zijn veel meer woningen dan rechten.
var isHoofdsplitsing = vve => {
  if (/hoofd\s*-?\s*(splitsing|vereniging)/i.test(vve.statutairenaam || '')) return true;
  var won = vve.aantal_woon_adr_in_vve || 0, rechten = vve.aantal_app_rechten || 0;
  return won >= 20 && rechten > 0 && rechten * 4 < won;
};
var HOOFDSPLITSING_UITLEG = 'Waarschijnlijk een hoofdsplitsing: de woningen vallen onder onderverenigingen, die niet in de data staan. Die beslissen over de afzonderlijke woningen.';
var adresTelling = vve => {
  var n = (v, een, meer) => v + ' ' + (v === 1 ? een : meer);
  var delen = [n(vve.aantal_woon_adr_in_vve || 0, 'woning', 'woningen')];
  if (vve.aantal_niet_woon_adr_in_vve) delen.push(vve.aantal_niet_woon_adr_in_vve + ' niet-woon');
  if (vve.aantal_overig_adr_in_vve) delen.push(vve.aantal_overig_adr_in_vve + ' overig');
  var t = delen.join(' · ');
  if (vve.aantal_app_rechten) t += '\n' + n(vve.aantal_app_rechten, 'appartementsrecht', 'appartementsrechten');
  if (isHoofdsplitsing(vve)) t += '\n' + HOOFDSPLITSING_UITLEG;
  return t;
};
var kopieerMapnaam = (e, naam) => {
  e.stopPropagation();
  if (!naam || !navigator.clipboard) return;
  var el = e.currentTarget.closest('.xl-cell-map') || e.currentTarget;
  navigator.clipboard.writeText(naam).then(() => {
    el.dataset.gekopieerd = '1';
    setTimeout(() => { delete el.dataset.gekopieerd; }, 900);
  });
};
var APP_EXTERN = (function () {
  try {
    var s = document.currentScript && document.currentScript.src;
    return !!s && new URL(s).host !== location.host;
  } catch (e) { return false; }
})();
// Favicon uit dezelfde map als dit script (Pages, of lokaal bij het testen).
(function zetFavicon() {
  try {
    if (document.querySelector('link[rel~="icon"]')) return;
    var s = document.currentScript && document.currentScript.src;
    var l = document.createElement('link');
    l.rel = 'icon';
    l.type = 'image/svg+xml';
    l.href = (s ? s.replace(/[^/]*$/, '') : '') + 'favicon.svg';
    document.head.appendChild(l);
  } catch (e) {}
})();
var APP_BUILD_DATE = '2026-09-03';
var APP_EXPIRY_DAYS = 58;
var _S = 'hrlm-vve';
var _K = d => {
  var h = 0;
  var s = _S + d;
  for (var i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36).toUpperCase();
};
var APP_EXPIRY_DATE = new Date(new Date(APP_BUILD_DATE).getTime() + APP_EXPIRY_DAYS * 86400000);
var isAppExpired = () => new Date() > APP_EXPIRY_DATE;
var isActivated = () => {
  try {
    return localStorage.getItem('vve_activation_key') === _K(APP_BUILD_DATE);
  } catch (e) {
    return false;
  }
};
var activateApp = key => {
  if (key.trim().toUpperCase() === _K(APP_BUILD_DATE)) {
    localStorage.setItem('vve_activation_key', key.trim().toUpperCase());
    return true;
  }
  return false;
};

// Utility functions
var formatCurrency = value => {
  if (!value) return '-';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value);
};
var formatAddress = item => {
  var addr = `${item.straatnaam} ${item.huisnummer}`;
  if (item.huisletter) addr += item.huisletter;
  if (item.huisnummertoevoeging) addr += `-${item.huisnummertoevoeging}`;
  return addr;
};
var getEnergyClass = label => {
  if (!label || label === '-') return 'bg-pa-gray-300 text-pa-gray-700';
  if (label.startsWith('A')) return 'energy-A';
  if (label === 'B') return 'energy-B';
  if (label === 'C') return 'energy-C';
  if (label === 'D') return 'energy-D';
  if (label === 'E') return 'energy-E';
  if (label === 'F') return 'energy-F';
  if (label === 'G') return 'energy-G';
  return 'bg-pa-gray-300';
};

// Parse pasted email content to extract search terms
var parseEmailContent = text => {
  // Check if this looks like a pasted email (multiple lines, contains known fields)
  var lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 3) return null; // Not a multi-line paste

  var result = {
    vveNaam: null,
    adres: null,
    aantalAppartementen: null,
    contactpersoon: null,
    email: null,
    telefoon: null
  };

  // Look for field-value pairs
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].toLowerCase();
    var nextLine = lines[i + 1] || '';
    if (line.includes('naam van de vve') || line === 'naam van de vve') {
      result.vveNaam = nextLine;
    } else if (line.includes('adres van de vve') || line === 'adres van de vve') {
      result.adres = nextLine;
    } else if (line.includes('hoeveel appartementen') || line.includes('aantal appartementen')) {
      result.aantalAppartementen = nextLine;
    } else if (line === 'naam contactpersoon' || line.includes('naam contactpersoon')) {
      result.contactpersoon = nextLine;
    } else if (line === 'e-mailadres' || line === 'email') {
      result.email = nextLine;
    } else if (line === 'telefoonnummer' || line === 'telefoon') {
      result.telefoon = nextLine;
    }
  }

  // Return the best search term: address first, then VvE name
  if (result.adres) return result;
  if (result.vveNaam) return result;
  return null;
};

// Components
var SearchBar = ({
  value,
  onChange,
  onParsedEmail,
  parsedData,
  placeholder
}) => {
  var handlePaste = e => {
    var pastedText = e.clipboardData.getData('text');
    var parsed = parseEmailContent(pastedText);
    if (parsed && (parsed.adres || parsed.vveNaam)) {
      e.preventDefault();
      onParsedEmail(parsed);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: value,
    onChange: e => onChange(e.target.value),
    onPaste: handlePaste,
    placeholder: placeholder,
    className: "w-full px-4 py-2.5 pl-10 text-base sm:text-sm bg-white bg-opacity-95 border border-white border-opacity-30 rounded focus:bg-white focus:border-pa-blue-500 focus:outline-none focus:ring-2 focus:ring-pa-blue-500 focus:ring-opacity-30 transition-all placeholder-gray-500"
  }), /*#__PURE__*/React.createElement("svg", {
    className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pa-gray-500",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
  })));
};
var ParsedEmailCard = ({
  data,
  onClear
}) => /*#__PURE__*/React.createElement("div", {
  className: "mt-3 bg-white border-l-4 border-pa-blue-500 rounded p-3 shadow-pa"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex justify-between items-start mb-2"
}, /*#__PURE__*/React.createElement("h3", {
  className: "text-sm font-semibold text-pa-gray-800"
}, "Aanmelding herkend"), /*#__PURE__*/React.createElement("button", {
  onClick: onClear,
  className: "text-pa-blue-500 hover:text-pa-blue-700 text-xs font-medium"
}, "Wissen")), /*#__PURE__*/React.createElement("div", {
  className: "grid grid-cols-2 gap-2 text-sm"
}, data.adres && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
  className: "text-pa-gray-500"
}, "Adres:"), /*#__PURE__*/React.createElement("span", {
  className: "ml-2 font-medium text-pa-gray-800"
}, data.adres)), data.vveNaam && /*#__PURE__*/React.createElement("div", {
  className: "col-span-2"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-pa-blue-500"
}, "VvE:"), /*#__PURE__*/React.createElement("span", {
  className: "ml-2 font-medium text-pa-gray-800"
}, data.vveNaam)), data.aantalAppartementen && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
  className: "text-pa-blue-500"
}, "Appartementen:"), /*#__PURE__*/React.createElement("span", {
  className: "ml-2 font-medium text-pa-gray-800"
}, data.aantalAppartementen)), data.contactpersoon && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
  className: "text-pa-blue-500"
}, "Contact:"), /*#__PURE__*/React.createElement("span", {
  className: "ml-2 font-medium text-pa-gray-800"
}, data.contactpersoon)), data.email && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
  className: "text-pa-blue-500"
}, "Email:"), /*#__PURE__*/React.createElement("span", {
  className: "ml-2 font-medium text-pa-gray-800"
}, data.email)), data.telefoon && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
  className: "text-pa-blue-500"
}, "Telefoon:"), /*#__PURE__*/React.createElement("span", {
  className: "ml-2 font-medium text-pa-gray-800"
}, data.telefoon))));
var FilterChip = ({
  label,
  active,
  onClick,
  count,
  disabled
}) => /*#__PURE__*/React.createElement("button", {
  onClick: onClick,
  disabled: disabled || count === 0,
  className: `px-3 py-1.5 rounded text-sm font-medium transition-all pa-button ${active ? 'bg-pa-purple-500 text-white shadow-pa' : disabled || count === 0 ? 'bg-pa-gray-100 text-pa-gray-400 cursor-not-allowed' : 'bg-white text-pa-gray-600 hover:bg-pa-gray-50 border border-pa-gray-200'}`
}, label, " ", count !== undefined && /*#__PURE__*/React.createElement("span", {
  className: "ml-1 opacity-70"
}, "(", count, ")"));
var FacetSection = ({
  title,
  children,
  activeCount
}) => /*#__PURE__*/React.createElement("div", {
  className: "mb-1 pb-1 border-b border-pa-gray-200 last:border-b-0"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between mb-0.5",
  style: {
    paddingTop: 4
  }
}, /*#__PURE__*/React.createElement("h3", {
  className: "text-[10px] font-semibold text-pa-gray-500 uppercase tracking-wide"
}, title), activeCount > 0 && /*#__PURE__*/React.createElement("span", {
  style: {
    fontSize: 9,
    background: '#217346',
    color: 'white',
    padding: '1px 5px',
    borderRadius: 2,
    fontWeight: 600
  }
}, activeCount)), /*#__PURE__*/React.createElement("div", {
  className: "space-y-0"
}, children));
var FacetOption = ({
  label,
  count,
  active,
  onClick,
  disabled,
  isAllOption
}) => /*#__PURE__*/React.createElement("button", {
  onClick: onClick,
  disabled: disabled || count === 0,
  className: `w-full flex items-center justify-between px-1.5 py-0.5 text-[11px] transition-all ${active ? 'xl-facet-active' : disabled || count === 0 ? 'text-pa-gray-300 cursor-not-allowed' : 'text-pa-gray-700 hover:bg-pa-gray-100'}`
}, /*#__PURE__*/React.createElement("span", {
  className: "flex items-center gap-1.5 truncate"
}, !isAllOption && /*#__PURE__*/React.createElement("span", {
  className: `xl-check ${active ? 'xl-check-active' : ''}`,
  style: active ? {
    background: '#217346',
    borderColor: '#217346'
  } : {}
}, active && /*#__PURE__*/React.createElement("svg", {
  className: "w-2 h-2 text-white",
  fill: "none",
  stroke: "currentColor",
  viewBox: "0 0 24 24"
}, /*#__PURE__*/React.createElement("path", {
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 3,
  d: "M5 13l4 4L19 7"
}))), /*#__PURE__*/React.createElement("span", {
  className: "truncate"
}, label)), /*#__PURE__*/React.createElement("span", {
  className: `ml-1 tabular-nums text-[10px] ${active ? 'text-xl-green-600' : 'text-pa-gray-400'}`
}, count.toLocaleString()));
var FacetOptionWithDesc = ({
  label,
  desc,
  count,
  active,
  onClick,
  disabled
}) => /*#__PURE__*/React.createElement("button", {
  onClick: onClick,
  disabled: disabled || count === 0,
  className: `w-full text-left px-1.5 py-1.5 text-[11px] transition-all ${active ? 'bg-pa-purple-500 bg-opacity-10 text-pa-purple-500 font-medium' : disabled || count === 0 ? 'text-pa-gray-300 cursor-not-allowed' : 'text-pa-gray-700 hover:bg-pa-gray-100'}`
}, /*#__PURE__*/React.createElement("span", {
  className: "flex items-start gap-1.5"
}, /*#__PURE__*/React.createElement("span", {
  className: `w-3 h-3 mt-0.5 border rounded-sm flex-shrink-0 flex items-center justify-center transition-all ${active ? 'bg-pa-purple-500 border-pa-purple-500' : 'border-pa-gray-400'}`
}, active && /*#__PURE__*/React.createElement("svg", {
  className: "w-2 h-2 text-white",
  fill: "none",
  stroke: "currentColor",
  viewBox: "0 0 24 24"
}, /*#__PURE__*/React.createElement("path", {
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 3,
  d: "M5 13l4 4L19 7"
}))), /*#__PURE__*/React.createElement("span", {
  className: "flex-1 min-w-0"
}, /*#__PURE__*/React.createElement("span", {
  className: "flex items-baseline justify-between"
}, /*#__PURE__*/React.createElement("span", {
  className: "truncate"
}, label), /*#__PURE__*/React.createElement("span", {
  className: `ml-1 tabular-nums text-[10px] flex-shrink-0 ${active ? 'text-pa-purple-500' : 'text-pa-gray-400'}`
}, count.toLocaleString())), desc && /*#__PURE__*/React.createElement("span", {
  className: `block text-[9px] leading-tight mt-0.5 ${active ? 'text-pa-purple-400' : 'text-pa-gray-400'}`
}, desc))));
var StatCard = ({
  label,
  value,
  icon,
  color = 'blue'
}) => /*#__PURE__*/React.createElement("div", {
  className: "pa-card p-4 border-l-4 border-pa-purple-500"
}, /*#__PURE__*/React.createElement("div", {
  className: "text-xs text-pa-gray-500 mb-1 font-medium uppercase tracking-wide"
}, label), /*#__PURE__*/React.createElement("div", {
  className: "text-2xl font-semibold text-pa-gray-800"
}, value));
var getGrootteLabel = aantal => {
  if (aantal <= 2) return {
    label: 'Mini',
    color: 'bg-green-50 text-green-700 border border-green-200'
  };
  if (aantal <= 7) return {
    label: 'Klein',
    color: 'bg-pa-blue-50 text-pa-blue-700 border border-pa-blue-200'
  };
  return {
    label: 'Groot',
    color: 'bg-pa-purple-50 text-pa-purple-700 border border-pa-purple-200'
  };
};

// Bepaal of een VBO een woonfunctie heeft (energielabel is alleen relevant voor woonunits)
var isWoonunit = a => {
  var t = (a.basiseenheidtype || '').toLowerCase();
  return t.includes('woning') || t.includes('appartement');
};

// Geef het energielabel van een adres terug, maar alleen voor woonunits
var getDisplayEnergyLabel = a => isWoonunit(a) ? a.energielabel || '-' : '-';
var getAverageEnergyLabel = addresses => {
  var labelOrder = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
  var validLabels = addresses.filter(isWoonunit).map(a => a.energielabel).filter(l => l && l !== '-' && labelOrder.includes(l));
  if (validLabels.length === 0) return '-';
  var scores = validLabels.map(l => labelOrder.indexOf(l));
  var avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return labelOrder[Math.min(avgScore, labelOrder.length - 1)] || '-';
};
var getWozByYear = (item, jaar) => item['woz' + (jaar || '2025')] || null;
var AddressCard = ({
  item,
  onClick,
  selected,
  compact,
  scrollRef,
  colTemplate,
  dossierVisible,
  activeWozJaar
}) => {
  var cardRef = useRef(null);
  useEffect(() => {
    if (selected && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [selected]);

  // Grid sub-row mode (inside Excel-style VveGroupCard)
  if (colTemplate) {
    return /*#__PURE__*/React.createElement("div", {
      ref: cardRef,
      "data-address-id": item.id,
      onClick: () => onClick(item),
      className: `xl-grid-subrow ${selected ? 'xl-row-selected' : ''}`,
      style: {
        gridTemplateColumns: colTemplate
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "xl-rownum",
      style: {
        background: '#f5f5f5'
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell",
      style: {
        paddingLeft: 22,
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "truncate text-pa-gray-700",
      style: {
        fontSize: 11
      }
    }, formatAddress(item)), item.oppervlakte ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: '#aaa',
        flexShrink: 0
      }
    }, item.oppervlakte, "m²") : null), MAPNAMEN_AAN && /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    }), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell xl-cell-center"
    }), /*#__PURE__*/React.createElement("div", {
      className: `xl-cell xl-cell-center font-medium ${getEnergyClass(getDisplayEnergyLabel(item))}`,
      style: {
        fontSize: 11
      }
    }, getDisplayEnergyLabel(item)), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    }), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell xl-cell-center",
      style: {
        fontSize: 11,
        color: '#888'
      }
    }, item.bouwjaar_gerelateerd_pand || ''), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell xl-cell-right",
      style: {
        fontSize: 11,
        color: '#666'
      }
    }, formatCurrency(getWozByYear(item, activeWozJaar))), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    }), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    }), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    }), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    }), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    }), dossierVisible && /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    }), dossierVisible && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    }), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    }), /*#__PURE__*/React.createElement("div", {
      className: "xl-cell"
    })));
  }
  return /*#__PURE__*/React.createElement("div", {
    ref: cardRef,
    "data-address-id": item.id,
    onClick: () => onClick(item),
    className: `p-2 cursor-pointer ${selected ? 'bg-pa-gray-100 border-l-2 border-xl-green-500' : 'hover:bg-pa-gray-50'} ${compact ? '' : 'bg-white border border-pa-gray-300'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between items-center gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: `text-pa-gray-800 ${compact ? 'text-sm' : ''}`
  }, formatAddress(item)), compact && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 mt-0.5 text-xs text-pa-gray-500"
  }, /*#__PURE__*/React.createElement("span", null, item.oppervlakte, " m²"), /*#__PURE__*/React.createElement("span", null, formatCurrency(getWozByYear(item, activeWozJaar))))), /*#__PURE__*/React.createElement("span", {
    className: `text-xs font-medium shrink-0 ${getEnergyClass(getDisplayEnergyLabel(item))}`
  }, getDisplayEnergyLabel(item))));
};

// ── Kaart tab — warmte helpers ────────────────────────────────────────────
var WARMTE_BINNEN_5 = new Set(['tussen nu en 2027', 'tussen 2028 en 2030']);
var classifyWarmteBuurt = naam => {
  var w = getWarmteData(naam);
  if (!w) return null;
  var vroeg = WARMTE_BINNEN_5.has(w.wijkwarmteplan);
  if (w.warmtevoorziening === 'Individueel') return vroeg ? 'ind-vroeg' : 'ind-laat';
  return vroeg ? 'net-vroeg' : 'net-laat';
};
var getWarmteLayerStyle = cat => {
  var S = {
    'ind-vroeg': {
      fillColor: 'url(#wk-p1)',
      color: '#a86010',
      weight: 1.2
    },
    'ind-laat': {
      fillColor: '#fdf0d0',
      color: '#c8a060',
      weight: 0.8
    },
    'net-vroeg': {
      fillColor: 'url(#wk-p3)',
      color: '#0a2f58',
      weight: 1.2
    },
    'net-laat': {
      fillColor: 'url(#wk-p4)',
      color: '#3878a8',
      weight: 0.8
    }
  };
  var s = S[cat] || {
    fillColor: '#eaeaea',
    color: '#ccc',
    weight: 0.5
  };
  return {
    ...s,
    fillOpacity: 1,
    opacity: 1
  };
};
var WARMTE_SVG_DEFS = `<defs id="wk-defs">
          <pattern id="wk-p1" patternUnits="userSpaceOnUse" width="14" height="14">
            <rect width="14" height="14" fill="#f8c86a"/>
            <circle cx="2.5" cy="2.5" r="2.4" fill="#b87018"/>
            <circle cx="9.5" cy="9.5" r="2.4" fill="#b87018"/>
            <circle cx="9.5" cy="2.5" r="2.4" fill="#d09030" opacity=".5"/>
            <circle cx="2.5" cy="9.5" r="2.4" fill="#d09030" opacity=".5"/>
          </pattern>
          <pattern id="wk-p3" patternUnits="userSpaceOnUse" width="10" height="10">
            <rect width="10" height="10" fill="#1e5898"/>
            <line x1="0" y1="0" x2="10" y2="10" stroke="rgba(255,255,255,.6)" stroke-width="2"/>
            <line x1="10" y1="0" x2="0" y2="10" stroke="rgba(255,255,255,.6)" stroke-width="2"/>
          </pattern>
          <pattern id="wk-p4" patternUnits="userSpaceOnUse" width="10" height="10">
            <rect width="10" height="10" fill="#c0daf4"/>
            <line x1="0" y1="0" x2="10" y2="10" stroke="#4a88c4" stroke-width="1.8"/>
            <line x1="10" y1="0" x2="0" y2="10" stroke="#4a88c4" stroke-width="1.8"/>
          </pattern>
        </defs>`;
var injectWarmtePatterns = mapInstance => {
  var svg = mapInstance.getPanes().overlayPane?.querySelector('svg');
  if (!svg) {
    setTimeout(() => injectWarmtePatterns(mapInstance), 200);
    return;
  }
  if (svg.querySelector('#wk-defs')) return;
  svg.insertAdjacentHTML('afterbegin', WARMTE_SVG_DEFS);
};

// Inline SVG swatches voor de legenda (zelfstandig, geen url(#) nodig)
var WarmteSwatch = ({
  cat
}) => {
  var w = 30,
    h = 18,
    xs = [-16, -6, 4, 14, 24, 34];
  if (cat === 'ind-vroeg') return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    overflow: "hidden",
    style: {
      display: 'block',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    width: w,
    height: h,
    fill: "#f8c86a",
    stroke: "#a86010",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "5",
    cy: "5",
    r: "2.4",
    fill: "#b87018"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15",
    cy: "5",
    r: "2.4",
    fill: "#b87018",
    opacity: ".4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "25",
    cy: "5",
    r: "2.4",
    fill: "#b87018"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "5",
    cy: "13",
    r: "2.4",
    fill: "#b87018",
    opacity: ".4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15",
    cy: "13",
    r: "2.4",
    fill: "#b87018"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "25",
    cy: "13",
    r: "2.4",
    fill: "#b87018",
    opacity: ".4"
  }));
  if (cat === 'ind-laat') return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    overflow: "hidden",
    style: {
      display: 'block',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    width: w,
    height: h,
    fill: "#fdf0d0",
    stroke: "#c8a060",
    strokeWidth: "1"
  }));
  if (cat === 'net-vroeg') return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    overflow: "hidden",
    style: {
      display: 'block',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    width: w,
    height: h,
    fill: "#1e5898",
    stroke: "#0a2f58",
    strokeWidth: "1"
  }), xs.map(x => /*#__PURE__*/React.createElement("line", {
    key: 'a' + x,
    x1: x,
    y1: "0",
    x2: x + h,
    y2: h,
    stroke: "rgba(255,255,255,.6)",
    strokeWidth: "2"
  })), xs.map(x => /*#__PURE__*/React.createElement("line", {
    key: 'b' + x,
    x1: x + h,
    y1: "0",
    x2: x,
    y2: h,
    stroke: "rgba(255,255,255,.6)",
    strokeWidth: "2"
  })));
  // net-laat
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    overflow: "hidden",
    style: {
      display: 'block',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    width: w,
    height: h,
    fill: "#c0daf4",
    stroke: "#3878a8",
    strokeWidth: "1"
  }), xs.map(x => /*#__PURE__*/React.createElement("line", {
    key: 'a' + x,
    x1: x,
    y1: "0",
    x2: x + h,
    y2: h,
    stroke: "#4a88c4",
    strokeWidth: "1.8"
  })), xs.map(x => /*#__PURE__*/React.createElement("line", {
    key: 'b' + x,
    x1: x + h,
    y1: "0",
    x2: x,
    y2: h,
    stroke: "#4a88c4",
    strokeWidth: "1.8"
  })));
};

// ── Kaart tab ──────────────────────────────────────────────────────────────
var KaartView = ({
  groups
}) => {
  var mapRef = useRef(null);
  var leafletMap = useRef(null);
  var buurtLayerMapRef = useRef({}); // buurtnaam.toLowerCase() → leaflet layer
  var buurtGeoLayerRef = useRef(null); // de geoJSON laag zelf
  var _useState = useState('loading'),
    _useState2 = _slicedToArray(_useState, 2),
    warmteStatus = _useState2[0],
    setWarmteStatus = _useState2[1]; // 'loading'|'ok'|'error'

  // Initialiseer kaart + laad buurtgrenzen met warmtekleuring (eenmalig)
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    var map = L.map(mapRef.current, {
      center: [52.387, 4.646],
      zoom: 13
    });
    L.tileLayer('https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.pdok.nl">PDOK</a> / BRT',
      maxZoom: 19
    }).addTo(map);
    leafletMap.current = map;

    // Buurtgrenzen + warmtekleuring via CBS WFS
    var filter = encodeURIComponent('<Filter><PropertyIsEqualTo><PropertyName>gemeentecode</PropertyName><Literal>GM0392</Literal></PropertyIsEqualTo></Filter>');
    fetch(`https://service.pdok.nl/cbs/wijkenbuurten/2023/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeName=wijkenbuurten:buurten&outputFormat=json&srsName=EPSG:4326&FILTER=${filter}`).then(r => r.json()).then(gj => {
      var layerMap = {};
      var geoLayer = L.geoJSON(gj, {
        style: ft => getWarmteLayerStyle(classifyWarmteBuurt(ft.properties.buurtnaam || '')),
        onEachFeature: (ft, lyr) => {
          var naam = ft.properties.buurtnaam || '';
          layerMap[naam.toLowerCase().trim()] = lyr;
          var w = getWarmteData(naam);
          if (!w) return;
          lyr.bindTooltip(`<b style="font-size:12px">${naam}</b><br><span style="font-size:10px;color:#555">${w.warmtevoorziening} · ${w.wijkwarmteplan}</span>`, {
            sticky: true,
            direction: 'top',
            offset: [0, -4]
          });
        }
      }).addTo(map);
      buurtGeoLayerRef.current = geoLayer;
      buurtLayerMapRef.current = layerMap;
      injectWarmtePatterns(map);
      setTimeout(() => injectWarmtePatterns(map), 100);
      setWarmteStatus('ok');
    }).catch(() => setWarmteStatus('error'));
  }, []);

  // Highlight buurten die overeenkomen met gefilterde VvE's
  useEffect(() => {
    var geoLayer = buurtGeoLayerRef.current;
    if (!geoLayer) return;
    var activeBuurten = new Set(groups.map(({
      vve
    }) => (vve.buurt || '').toLowerCase().trim()).filter(Boolean));
    geoLayer.eachLayer(lyr => {
      var naam = (lyr.feature?.properties?.buurtnaam || '').toLowerCase().trim();
      var cat = classifyWarmteBuurt(lyr.feature?.properties?.buurtnaam || '');
      var base = getWarmteLayerStyle(cat);
      if (activeBuurten.has(naam)) {
        // Actieve buurt: normale warmtekleuring + duidelijke rand
        lyr.setStyle({
          ...base,
          weight: 2.5,
          color: '#1a1a1a',
          opacity: 1
        });
      } else {
        // Inactieve buurt: weggedimde versie
        lyr.setStyle({
          ...base,
          fillOpacity: 0.12,
          color: '#bbb',
          weight: 0.3,
          opacity: 0.4
        });
      }
    });
  }, [groups]);
  var activeBuurtenCount = new Set(groups.map(({
    vve
  }) => vve.buurt).filter(Boolean)).size;
  var LEGEND_ITEMS = [['ind-vroeg', 'Individueel, binnen 5 jaar'], ['ind-laat', 'Individueel, 6 jaar en later'], ['net-vroeg', 'Warmtenet, binnen 5 jaar'], ['net-laat', 'Warmtenet, 6 jaar en later']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#f0f0f0',
      borderBottom: '1px solid #d0d0d0',
      padding: '4px 10px',
      fontSize: 11,
      color: '#555',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, activeBuurtenCount, " ", activeBuurtenCount === 1 ? 'buurt' : 'buurten', " met gefilterde VvE's (", groups.length, " VvE's)", warmteStatus === 'loading' && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      color: '#aaa'
    }
  }, "Wijkwarmtekaart laden…"), warmteStatus === 'error' && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      color: '#c66'
    }
  }, "⚠ Buurtgrenzen konden niet worden geladen")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: mapRef,
    style: {
      width: '100%',
      height: '100%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 28,
      right: 8,
      zIndex: 1000,
      background: 'white',
      border: '1.5px solid #aaa',
      borderRadius: 3,
      padding: '8px 11px',
      fontSize: 11,
      pointerEvents: 'none',
      boxShadow: '0 1px 5px rgba(0,0,0,.18)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      fontSize: 11,
      marginBottom: 6,
      borderBottom: '1px solid #eee',
      paddingBottom: 4
    }
  }, "Warmteprogramma per buurt"), LEGEND_ITEMS.map(([cat, label]) => /*#__PURE__*/React.createElement("div", {
    key: cat,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(WarmteSwatch, {
    cat: cat
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: '#333',
      lineHeight: 1.3
    }
  }, label))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 5,
      borderTop: '1px solid #eee',
      paddingTop: 4,
      fontSize: 9,
      color: '#aaa'
    }
  }, "Gearceerde buurten = gefilterde VvE's"))));
};

// ── Statistieken tab ───────────────────────────────────────────────────────
var StatistiekenView = ({
  groups,
  totalAddresses
}) => {
  var MiniBar = ({
    label,
    count,
    max,
    color
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 3
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 130,
      fontSize: 11,
      color: '#444',
      textAlign: 'right',
      flexShrink: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    title: label
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 16,
      background: '#f0f0f0',
      borderRadius: 1,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${Math.round(count / max * 100)}%`,
      background: color || '#217346',
      transition: 'width .3s'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      fontSize: 11,
      color: '#666',
      textAlign: 'right',
      flexShrink: 0
    }
  }, count));

  // Buurt distribution
  var buurtMap = {};
  groups.forEach(({
    vve
  }) => {
    buurtMap[vve.buurt] = (buurtMap[vve.buurt] || 0) + 1;
  });
  var buurten = Object.entries(buurtMap).sort((a, b) => b[1] - a[1]).slice(0, 12);

  // Bouwjaar distribution — per adres (alle adressen, niet alleen eerste per VvE)
  var bjMap = {
    '< 1900': 0,
    '1900–1944': 0,
    '1945–1975': 0,
    '1976–2000': 0,
    '2001–2015': 0,
    '2016+': 0,
    'Onbekend': 0
  };
  groups.forEach(({
    addresses
  }) => {
    addresses.forEach(addr => {
      var bj = parseInt(addr.bouwjaar_gerelateerd_pand);
      if (!bj) bjMap['Onbekend']++;else if (bj < 1900) bjMap['< 1900']++;else if (bj < 1945) bjMap['1900–1944']++;else if (bj < 1976) bjMap['1945–1975']++;else if (bj < 2001) bjMap['1976–2000']++;else if (bj < 2016) bjMap['2001–2015']++;else bjMap['2016+']++;
    });
  });

  // Grootte distribution
  var grootteMap = {
    'Mini (1-2)': 0,
    'Klein (3-7)': 0,
    'Middel (8-24)': 0,
    'Groot (25+)': 0
  };
  groups.forEach(({
    addresses
  }) => {
    var n = addresses.length;
    if (n <= 2) grootteMap['Mini (1-2)']++;else if (n <= 7) grootteMap['Klein (3-7)']++;else if (n <= 24) grootteMap['Middel (8-24)']++;else grootteMap['Groot (25+)']++;
  });

  // Energielabel distribution
  var labelMap = {};
  groups.forEach(({
    addresses
  }) => {
    addresses.forEach(a => {
      var l = a.energielabel || '?';
      labelMap[l] = (labelMap[l] || 0) + 1;
    });
  });
  var labelOrder = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', '-', '?'];
  var labelColors = {
    'A++++': '#1a7340',
    'A+++': '#1a7340',
    'A++': '#217346',
    'A+': '#2e8b57',
    'A': '#3cb371',
    'B': '#7ec850',
    'C': '#d4e157',
    'D': '#ffca28',
    'E': '#ffa726',
    'F': '#ef6c00',
    'G': '#d32f2f',
    '-': '#ccc',
    '?': '#ccc'
  };
  var labels = labelOrder.filter(l => labelMap[l]);

  // Erfgoedstatus — per adres
  var erfgoedOrder = ['Rijksmonument', 'Gemeentelijk monument', 'Orde 2', 'Geen monument'];
  var erfgoedColors = {
    'Rijksmonument': '#7c3aed',
    'Gemeentelijk monument': '#2563eb',
    'Orde 2': '#0891b2',
    'Geen monument': '#9ca3af'
  };
  var erfgoedMap = {
    'Rijksmonument': 0,
    'Gemeentelijk monument': 0,
    'Orde 2': 0,
    'Geen monument': 0
  };
  groups.forEach(({
    addresses
  }) => {
    addresses.forEach(a => {
      var m = a.monumentale_status || '';
      if (m === 'Rijksmonument') erfgoedMap['Rijksmonument']++;else if (m === 'Gemeentelijk monument') erfgoedMap['Gemeentelijk monument']++;else if (m === 'Orde 2') erfgoedMap['Orde 2']++;else erfgoedMap['Geen monument']++;
    });
  });
  var erfgoedMax = Math.max(...Object.values(erfgoedMap), 1);

  // VvE's met monument (elk type)
  var vveMetMonument = groups.filter(({
    addresses
  }) => addresses.some(a => a.monumentale_status && a.monumentale_status !== 'waarschijnlijk geen monument')).length;

  // VvE's in beschermd stadsgezicht
  var vvesBeschermd = groups.filter(({
    vve
  }) => getBeschermdGezicht(vve.vve_identificatie)).length;
  var Panel = ({
    title,
    children
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'white',
      border: '1px solid #d0d0d0',
      padding: '10px 14px',
      flex: 1,
      minWidth: 220
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: '#1a5c38',
      borderBottom: '2px solid #217346',
      paddingBottom: 6,
      marginBottom: 8,
      letterSpacing: '0.01em'
    }
  }, title), children);
  var bjMax = Math.max(...Object.values(bjMap), 1);
  var grMax = Math.max(...Object.values(grootteMap), 1);
  var buurtMax = buurten[0]?.[1] || 1;
  var lblMax = Math.max(...labels.map(l => labelMap[l] || 0), 1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: 16,
      background: '#f5f5f5'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginBottom: 14,
      flexWrap: 'wrap'
    }
  }, [{
    label: "VvE's gefilterd",
    value: groups.length.toLocaleString(),
    color: '#217346'
  }, {
    label: 'Adressen gefilterd',
    value: totalAddresses.toLocaleString(),
    color: '#1565c0'
  }, {
    label: 'Gem. adressen/VvE',
    value: groups.length ? (totalAddresses / groups.length).toFixed(1) : '—',
    color: '#6a1099'
  }, {
    label: 'Buurten',
    value: Object.keys(buurtMap).length,
    color: '#c06000'
  }, {
    label: "VvE's met monument",
    value: vveMetMonument.toLocaleString(),
    color: '#7c3aed'
  }, {
    label: 'Beschermd gezicht',
    value: vvesBeschermd.toLocaleString(),
    color: '#0891b2'
  }].map(k => /*#__PURE__*/React.createElement("div", {
    key: k.label,
    style: {
      background: 'white',
      border: '1px solid #d0d0d0',
      padding: '8px 14px',
      minWidth: 120,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: k.color
    }
  }, k.value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: '#888',
      marginTop: 1
    }
  }, k.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    title: "Bouwjaar (adressen)"
  }, Object.entries(bjMap).map(([k, v]) => /*#__PURE__*/React.createElement(MiniBar, {
    key: k,
    label: k,
    count: v,
    max: bjMax,
    color: "#217346"
  }))), /*#__PURE__*/React.createElement(Panel, {
    title: "Grootte VvE"
  }, Object.entries(grootteMap).map(([k, v]) => /*#__PURE__*/React.createElement(MiniBar, {
    key: k,
    label: k,
    count: v,
    max: grMax,
    color: "#1565c0"
  }))), /*#__PURE__*/React.createElement(Panel, {
    title: "Energielabel (adressen)"
  }, labels.map(l => /*#__PURE__*/React.createElement(MiniBar, {
    key: l,
    label: l,
    count: labelMap[l],
    max: lblMax,
    color: labelColors[l] || '#ccc'
  }))), /*#__PURE__*/React.createElement(Panel, {
    title: `Top buurten (${buurten.length})`
  }, buurten.map(([b, n]) => /*#__PURE__*/React.createElement(MiniBar, {
    key: b,
    label: b,
    count: n,
    max: buurtMax,
    color: "#c06000"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Panel, {
    title: "Monumentale status (adressen)"
  }, erfgoedOrder.map(k => /*#__PURE__*/React.createElement(MiniBar, {
    key: k,
    label: k,
    count: erfgoedMap[k],
    max: erfgoedMax,
    color: erfgoedColors[k]
  }))), /*#__PURE__*/React.createElement(Panel, {
    title: "Monumenten per bouwperiode"
  }, (() => {
    var mon = {
      '< 1900': 0,
      '1900–1944': 0,
      '1945–1975': 0,
      '1976–2000': 0,
      '2001–2015': 0,
      '2016+': 0
    };
    groups.forEach(({
      addresses
    }) => {
      addresses.forEach(a => {
        var m = a.monumentale_status || '';
        if (!m || m === 'waarschijnlijk geen monument') return;
        var bj = parseInt(a.bouwjaar_gerelateerd_pand);
        if (!bj) return;
        if (bj < 1900) mon['< 1900']++;else if (bj < 1945) mon['1900–1944']++;else if (bj < 1976) mon['1945–1975']++;else if (bj < 2001) mon['1976–2000']++;else if (bj < 2016) mon['2001–2015']++;else mon['2016+']++;
      });
    });
    var monMax = Math.max(...Object.values(mon), 1);
    return Object.entries(mon).map(([k, v]) => /*#__PURE__*/React.createElement(MiniBar, {
      key: k,
      label: k,
      count: v,
      max: monMax,
      color: "#7c3aed"
    }));
  })()), /*#__PURE__*/React.createElement(Panel, {
    title: "Beschermd stadsgezicht (VvE's)"
  }, (() => {
    var bsg = {};
    groups.forEach(({
      vve
    }) => {
      var b = getBeschermdGezicht(vve.vve_identificatie) || 'Geen';
      bsg[b] = (bsg[b] || 0) + 1;
    });
    var bsgMax = Math.max(...Object.values(bsg), 1);
    var bsgColors = {
      'Geen': '#9ca3af'
    };
    return Object.entries(bsg).sort((a, b) => b[1] - a[1]).map(([k, v]) => /*#__PURE__*/React.createElement(MiniBar, {
      key: k,
      label: k,
      count: v,
      max: bsgMax,
      color: bsgColors[k] || '#0891b2'
    }));
  })())),
  /*#__PURE__*/React.createElement("div", {style:{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-start',marginBottom:10,marginTop:10}},
    /*#__PURE__*/React.createElement(Panel, {title:"Gem. energielabel (per VvE)"},
      (function(){
        var LORDER=['A++++','A+++','A++','A+','A','B','C','D','E','F','G'];
        var LCOLORS={'A++++':'#1a7340','A+++':'#1a7340','A++':'#217346','A+':'#2e8b57','A':'#3cb371','B':'#7ec850','C':'#d4e157','D':'#ffca28','E':'#ffa726','F':'#ef6c00','G':'#d32f2f'};
        var lblMap={};LORDER.forEach(function(l){lblMap[l]=0;});
        groups.forEach(function(g){var lbl=getAverageEnergyLabel(g.addresses);if(LORDER.includes(lbl))lblMap[lbl]++;});
        var max=Math.max.apply(null,Object.values(lblMap).concat([1]));
        return LORDER.filter(function(l){return lblMap[l]>0;}).map(function(l){return /*#__PURE__*/React.createElement(MiniBar,{key:l,label:l,count:lblMap[l],max:max,color:LCOLORS[l]});});
      })()
    ),
    /*#__PURE__*/React.createElement(Panel, {title:"KvK-registratie"},
      (function(){
        var metKvk=0,zonderKvk=0;
        groups.forEach(function(g){
          var enr=getVveEnrichment(g.vve.vve_identificatie);
          if(g.vve.kvknummer||(enr&&enr.kvkNummer))metKvk++;else zonderKvk++;
        });
        var total=metKvk+zonderKvk,max=Math.max(metKvk,zonderKvk,1);
        return [
          /*#__PURE__*/React.createElement(MiniBar,{key:'met',label:'Met KvK ('+(total?Math.round(metKvk/total*100):0)+'%)',count:metKvk,max:max,color:'#217346'}),
          /*#__PURE__*/React.createElement(MiniBar,{key:'zonder',label:'Zonder KvK ('+(total?Math.round(zonderKvk/total*100):0)+'%)',count:zonderKvk,max:max,color:'#dc2626'})
        ];
      })()
    ),
    /*#__PURE__*/React.createElement(Panel, {title:"Corporatieparticipatie (VvE's)"},
      (function(){
        var lk=typeof GESPIKKELD_DATA!=='undefined'?GESPIKKELD_DATA:{};
        var cats=[{key:'geen',label:'0% corporatie'},{key:'laag',label:'1 – 25%'},{key:'matig',label:'26 – 50%'},{key:'hoog',label:'51 – 99%'},{key:'vol',label:'100% corporatie'}];
        var counts={geen:0,laag:0,matig:0,hoog:0,vol:0};
        groups.forEach(function(g){
          var entry=lk[g.vve.vve_identificatie],pct=entry?entry.pct_corporatie:0;
          if(pct===0)counts.geen++;else if(pct<=25)counts.laag++;else if(pct<=50)counts.matig++;else if(pct<100)counts.hoog++;else counts.vol++;
        });
        var max=Math.max.apply(null,Object.values(counts).concat([1]));
        return cats.map(function(c){return /*#__PURE__*/React.createElement(MiniBar,{key:c.key,label:c.label,count:counts[c.key],max:max,color:'#1565c0'});});
      })()
    ),
    /*#__PURE__*/React.createElement(Panel, {title:"Adviestraject-fases"},
      (function(){
        var counts={},zonder=0;
        groups.forEach(function(g){
          var enr=getVveEnrichment(g.vve.vve_identificatie);
          var fase=enr&&enr.adviestraject;
          if(fase)counts[fase]=(counts[fase]||0)+1;else zonder++;
        });
        var items=Object.entries(counts).sort(function(a,b){return b[1]-a[1];});
        var allMax=Math.max.apply(null,items.map(function(x){return x[1];}).concat([zonder,1]));
        var rows=items.map(function(x){return /*#__PURE__*/React.createElement(MiniBar,{key:x[0],label:x[0],count:x[1],max:allMax,color:'#0891b2'});});
        if(zonder>0)rows.push(/*#__PURE__*/React.createElement(MiniBar,{key:'geen',label:'Geen traject',count:zonder,max:allMax,color:'#9ca3af'}));
        return rows;
      })()
    )
  ),
  /*#__PURE__*/React.createElement("div", {style:{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-start',marginBottom:10}},
    /*#__PURE__*/React.createElement(Panel, {title:"Top 10 duurste straten (gem. WOZ 2025)"},
      (function(){
        var streetWoz={};
        groups.forEach(function(g){g.addresses.forEach(function(a){if(a.woz2025>0&&a.straatnaam){if(!streetWoz[a.straatnaam])streetWoz[a.straatnaam]=[];streetWoz[a.straatnaam].push(a.woz2025);}});});
        var straten=Object.entries(streetWoz).map(function(e){return {name:e[0],avg:e[1].reduce(function(a,b){return a+b;},0)/e[1].length};}).sort(function(a,b){return b.avg-a.avg;}).slice(0,10);
        var max=straten[0]?straten[0].avg:1;
        return straten.map(function(s){return /*#__PURE__*/React.createElement(MiniBar,{key:s.name,label:s.name+' (€'+Math.round(s.avg/1000)+'k)',count:Math.round(s.avg),max:max,color:'#c06000'});});
      })()
    ),
    /*#__PURE__*/React.createElement(Panel, {title:"Gespikkeld per buurt (% VvE's)"},
      (function(){
        var lk=typeof GESPIKKELD_DATA!=='undefined'?GESPIKKELD_DATA:{};
        var buurten={};
        groups.forEach(function(g){
          var buurt=g.vve.buurt||'Onbekend';
          if(!buurten[buurt])buurten[buurt]={total:0,gespikkeld:0};
          buurten[buurt].total++;
          var entry=lk[g.vve.vve_identificatie];
          if(entry&&entry.gespikkeld)buurten[buurt].gespikkeld++;
        });
        var rows=Object.entries(buurten).filter(function(e){return e[1].total>=3;}).map(function(e){return {name:e[0],pct:Math.round(e[1].gespikkeld/e[1].total*100)};}).sort(function(a,b){return b.pct-a.pct;}).slice(0,10);
        var max=rows[0]?rows[0].pct:1;
        return rows.map(function(r){return /*#__PURE__*/React.createElement(MiniBar,{key:r.name,label:r.name+' ('+r.pct+'%)',count:r.pct,max:max,color:'#7c3aed'});});
      })()
    ),
    /*#__PURE__*/React.createElement(Panel, {title:"WOZ vs energielabel (VvE's)"},
      (function(){
        var LORDER=['A++++','A+++','A++','A+','A','B','C','D','E','F','G'];
        var vvesData=groups.map(function(g){
          var lbl=getAverageEnergyLabel(g.addresses);
          var vals=g.addresses.filter(function(a){return isWoonunit(a)&&a.woz2025>0;}).map(function(a){return a.woz2025;});
          var avgWoz=vals.length?vals.reduce(function(s,v){return s+v;},0)/vals.length:null;
          return {avgWoz:avgWoz,lblIdx:LORDER.indexOf(lbl)};
        }).filter(function(d){return d.avgWoz&&d.lblIdx>=0;});
        var sorted=vvesData.map(function(d){return d.avgWoz;}).slice().sort(function(a,b){return a-b;});
        var medianWoz=sorted[Math.floor(sorted.length/2)]||1;
        var cats={'Duur + goed label':0,'Duur + slecht label ★':0,'Goedkoop + goed label':0,'Goedkoop + slecht label':0};
        vvesData.forEach(function(d){
          var duur=d.avgWoz>=medianWoz,goed=d.lblIdx<=4;
          if(duur&&goed)cats['Duur + goed label']++;
          else if(duur&&!goed)cats['Duur + slecht label ★']++;
          else if(!duur&&goed)cats['Goedkoop + goed label']++;
          else cats['Goedkoop + slecht label']++;
        });
        var max=Math.max.apply(null,Object.values(cats).concat([1]));
        var colors={'Duur + goed label':'#3cb371','Duur + slecht label ★':'#ef6c00','Goedkoop + goed label':'#1565c0','Goedkoop + slecht label':'#9ca3af'};
        return Object.entries(cats).map(function(e){return /*#__PURE__*/React.createElement(MiniBar,{key:e[0],label:e[0],count:e[1],max:max,color:colors[e[0]]});});
      })()
    ),
    /*#__PURE__*/React.createElement(Panel, {title:"Bouwjaar vs gem. WOZ (VvE's)"},
      (function(){
        var periods={'< 1900':{sum:0,n:0},'1900–1944':{sum:0,n:0},'1945–1975':{sum:0,n:0},'1976–2000':{sum:0,n:0},'2001–2015':{sum:0,n:0},'2016+':{sum:0,n:0}};
        groups.forEach(function(g){
          var vals=g.addresses.filter(function(a){return isWoonunit(a)&&a.woz2025>0;}).map(function(a){return a.woz2025;});
          var avgWoz=vals.length?vals.reduce(function(s,v){return s+v;},0)/vals.length:0;
          if(!avgWoz)return;
          var bjStr=g.addresses.map(function(a){return a.bouwjaar_gerelateerd_pand;}).find(function(b){return parseInt(b)>1000;})||'0';
          var bj=parseInt(bjStr)||0;
          var p=bj<1900?'< 1900':bj<1945?'1900–1944':bj<1976?'1945–1975':bj<2001?'1976–2000':bj<2016?'2001–2015':'2016+';
          if(periods[p]){periods[p].sum+=avgWoz;periods[p].n++;}
        });
        var avgs=Object.entries(periods).map(function(e){return {k:e[0],avg:e[1].n?e[1].sum/e[1].n:0};});
        var max=Math.max.apply(null,avgs.map(function(a){return a.avg;}).concat([1]));
        return avgs.map(function(a){return /*#__PURE__*/React.createElement(MiniBar,{key:a.k,label:a.k+(a.avg?': €'+Math.round(a.avg/1000)+'k':''),count:Math.round(a.avg),max:max,color:'#6a1099'});});
      })()
    )
  ),
  (() => {
    // Opmerkelijke VvE's — berekend op gefilterde selectie
    var LORDER = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
    var LCOLORS = {'A++++':'#1a7340','A+++':'#1a7340','A++':'#217346','A+':'#2e8b57','A':'#3cb371','B':'#7ec850','C':'#d4e157','D':'#ffca28','E':'#ffa726','F':'#ef6c00','G':'#d32f2f'};
    var vvesWithLbl = groups.map(function(g) {
      var lbl = getAverageEnergyLabel(g.addresses);
      return {vve: g.vve, addresses: g.addresses, label: lbl, labelIdx: LORDER.indexOf(lbl)};
    }).filter(function(g) { return g.labelIdx >= 0; });
    vvesWithLbl.sort(function(a, b) { return a.labelIdx - b.labelIdx; });
    var allAddrs = groups.reduce(function(acc, g) { return acc.concat(g.addresses); }, []);
    var woningen = allAddrs.filter(function(a) { return isWoonunit(a) && a.woz2025 > 0; }).sort(function(a, b) { return b.woz2025 - a.woz2025; });
    var vvesMetWoz = groups.map(function(g) {
      var vals = g.addresses.filter(function(a) { return isWoonunit(a) && a.woz2025 > 0; }).map(function(a) { return a.woz2025; });
      return {vve: g.vve, avgWoz: vals.length ? vals.reduce(function(s, v) { return s + v; }, 0) / vals.length : 0};
    }).filter(function(g) { return g.avgWoz > 0; }).sort(function(a, b) { return b.avgWoz - a.avgWoz; });
    var metBouwjaar = allAddrs.filter(function(a) { return parseInt(a.bouwjaar_gerelateerd_pand) > 1000; }).sort(function(a, b) { return parseInt(a.bouwjaar_gerelateerd_pand) - parseInt(b.bouwjaar_gerelateerd_pand); });
    var metKvk = groups.filter(function(g) { return g.vve.kvknummer; }).sort(function(a, b) { return parseInt(a.vve.kvknummer) - parseInt(b.vve.kvknummer); });
    var grootsteMetSlecht = vvesWithLbl.slice().sort(function(a, b) {
      if (b.labelIdx !== a.labelIdx) return b.labelIdx - a.labelIdx;
      return (b.vve.aantal_woon_adr_in_vve || 0) - (a.vve.aantal_woon_adr_in_vve || 0);
    })[0];
    var fmt = function(n) { return n ? '€ ' + Math.round(n).toLocaleString('nl-NL') : '-'; };
    var vveNm = function(v) { return v.statutairenaam || v.vve_identificatie || '?'; };
    var addrStr = function(a) { return (a.straatnaam || '') + ' ' + (a.huisnummer || '') + ', ' + (a.postcode || ''); };
    var navTo = function(item) { return function() { window.dispatchEvent(new CustomEvent('vve-navigate', {detail: item})); }; };
    var cards = [
      vvesWithLbl.length && {label:'Slechtste gem. energielabel', main:vveNm(vvesWithLbl[vvesWithLbl.length-1].vve), sub:vvesWithLbl[vvesWithLbl.length-1].addresses.length+' wooneenheden', badge:vvesWithLbl[vvesWithLbl.length-1].label, item:vvesWithLbl[vvesWithLbl.length-1].vve},
      vvesWithLbl.length && {label:'Beste gem. energielabel', main:vveNm(vvesWithLbl[0].vve), sub:vvesWithLbl[0].addresses.length+' wooneenheden', badge:vvesWithLbl[0].label, item:vvesWithLbl[0].vve},
      woningen.length && {label:'Duurste appartement (WOZ 2025)', main:fmt(woningen[0].woz2025), sub:addrStr(woningen[0]), item:woningen[0]},
      woningen.length && {label:'Goedkoopste appartement (WOZ 2025)', main:fmt(woningen[woningen.length-1].woz2025), sub:addrStr(woningen[woningen.length-1]), item:woningen[woningen.length-1]},
      groups.length && {label:'Grootste VvE', main:vveNm(groups.slice().sort(function(a,b){return (b.vve.aantal_woon_adr_in_vve||0)-(a.vve.aantal_woon_adr_in_vve||0);})[0].vve), sub:(groups.slice().sort(function(a,b){return (b.vve.aantal_woon_adr_in_vve||0)-(a.vve.aantal_woon_adr_in_vve||0);})[0].vve.aantal_woon_adr_in_vve||'?')+' adressen', item:groups.slice().sort(function(a,b){return (b.vve.aantal_woon_adr_in_vve||0)-(a.vve.aantal_woon_adr_in_vve||0);})[0].vve},
      grootsteMetSlecht && {label:'Grootste VvE met slechtste label', main:vveNm(grootsteMetSlecht.vve), sub:(grootsteMetSlecht.vve.aantal_woon_adr_in_vve||'?')+' adressen', badge:grootsteMetSlecht.label, item:grootsteMetSlecht.vve},
      metBouwjaar.length && {label:'Oudste pand', main:addrStr(metBouwjaar[0]), sub:'Bouwjaar '+metBouwjaar[0].bouwjaar_gerelateerd_pand, item:metBouwjaar[0]},
      metBouwjaar.length && {label:'Nieuwste pand', main:addrStr(metBouwjaar[metBouwjaar.length-1]), sub:'Bouwjaar '+metBouwjaar[metBouwjaar.length-1].bouwjaar_gerelateerd_pand, item:metBouwjaar[metBouwjaar.length-1]},
      vvesMetWoz.length && {label:'Hoogste gem. WOZ per VvE', main:fmt(vvesMetWoz[0].avgWoz), sub:vveNm(vvesMetWoz[0].vve), item:vvesMetWoz[0].vve},
      vvesMetWoz.length && {label:'Laagste gem. WOZ per VvE', main:fmt(vvesMetWoz[vvesMetWoz.length-1].avgWoz), sub:vveNm(vvesMetWoz[vvesMetWoz.length-1].vve), item:vvesMetWoz[vvesMetWoz.length-1].vve},
      metKvk.length && {label:'Laagste KvK-nummer', main:metKvk[0].vve.kvknummer, sub:vveNm(metKvk[0].vve), item:metKvk[0].vve}
    ].filter(Boolean);
    return /*#__PURE__*/React.createElement("div", {style:{marginTop:14}},
      /*#__PURE__*/React.createElement("div", {style:{fontSize:13,fontWeight:700,color:'#1a5c38',borderBottom:'2px solid #217346',paddingBottom:6,marginBottom:10}}, "Opmerkelijke VvE's — in gefilterde selectie"),
      /*#__PURE__*/React.createElement("div", {style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}},
        cards.map(function(c, i) {
          return /*#__PURE__*/React.createElement("div", {
            key: i,
            onClick: navTo(c.item),
            onMouseEnter: function(e){e.currentTarget.style.background='#f1f5f9';e.currentTarget.style.borderColor='#94a3b8';},
            onMouseLeave: function(e){e.currentTarget.style.background='#f8fafc';e.currentTarget.style.borderColor='#e2e8f0';},
            style:{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:'10px 12px',display:'flex',flexDirection:'column',gap:3,cursor:'pointer',transition:'background 0.12s,border-color 0.12s'}
          },
            /*#__PURE__*/React.createElement("div", {style:{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',color:'#64748b'}}, c.label),
            /*#__PURE__*/React.createElement("div", {style:{fontSize:12,fontWeight:600,color:'#1e293b',lineHeight:1.3}}, c.main),
            c.sub && /*#__PURE__*/React.createElement("div", {style:{fontSize:11,color:'#64748b'}}, c.sub),
            c.badge && /*#__PURE__*/React.createElement("span", {style:{display:'inline-block',marginTop:2,padding:'1px 7px',borderRadius:10,fontSize:11,fontWeight:700,color:'white',background:LCOLORS[c.badge]||'#ccc',width:'fit-content'}}, c.badge)
          );
        })
      )
    );
  })());
};
var VveGroupCard = ({
  vve,
  addresses,
  onSelectItem,
  selectedItem,
  isExpanded,
  onToggleExpand,
  crmConnected,
  rowIndex,
  colTemplate,
  dossierVisible,
  gespikkeldLookup,
  activeWozJaar
}) => {
  var cardRef = useRef(null);
  var crmRecord = crmConnected ? getCrmForVve(vve.vve_identificatie) : null;
  var enrichment = getVveEnrichment(vve.vve_identificatie);
  var avgWoz = addresses.length > 0 ? addresses.reduce((sum, a) => sum + (getWozByYear(a, activeWozJaar) || 0), 0) / addresses.length : 0;
  var avgEnergy = getAverageEnergyLabel(addresses);
  var beschermd = getBeschermdGezicht(vve.vve_identificatie);
  var warmte = getWarmteProg(vve);
  var sortedAddresses = [...addresses].sort((a, b) => {
    var numA = parseInt(a.huisnummer) || 0;
    var numB = parseInt(b.huisnummer) || 0;
    if (numA !== numB) return numA - numB;
    return (a.huislettertoevoeging || '').localeCompare(b.huislettertoevoeging || '');
  });
  var firstAddress = sortedAddresses[0];
  var hasSelectedAddress = selectedItem && addresses.some(a => a.id === selectedItem.id);
  useEffect(() => {
    if (hasSelectedAddress && !isExpanded && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    }
  }, [hasSelectedAddress, isExpanded]);
  var handleRowClick = () => {
    onToggleExpand(vve.vve_identificatie);
    var isDesktop = window.innerWidth >= 1024;
    if (firstAddress && isDesktop) onSelectItem(firstAddress);
  };
  var noKvk = !getKvkSource(vve, enrichment);
  return /*#__PURE__*/React.createElement("div", {
    ref: cardRef
  }, /*#__PURE__*/React.createElement("div", {
    className: `xl-grid-row ${hasSelectedAddress ? isExpanded ? 'xl-row-has-selected' : 'xl-row-selected' : ''}`,
    style: {
      gridTemplateColumns: colTemplate
    },
    onClick: handleRowClick
  }, /*#__PURE__*/React.createElement("div", {
    className: "xl-rownum"
  }, rowIndex), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell xl-cell-naam",
    style: {
      gap: 5,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      width: 14,
      height: 14,
      border: '1px solid #bbb',
      borderRadius: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      lineHeight: 1,
      color: '#555',
      background: 'white',
      cursor: 'pointer',
      fontWeight: 'bold',
      marginTop: 1
    },
    onClick: e => {
      e.stopPropagation();
      onToggleExpand(vve.vve_identificatie);
    },
    title: isExpanded ? 'Inklappen' : 'Uitklappen'
  }, isExpanded ? '−' : '+'), /*#__PURE__*/React.createElement("span", {
    className: "xl-naam-text",
    style: {
      fontSize: 12,
      color: '#1a1a1a'
    },
    title: vve.statutairenaam
  }, enrichment?.nickname ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      color: '#217346'
    }
  }, enrichment.nickname), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#aaa',
      marginLeft: 5,
      fontWeight: 400,
      fontSize: 10
    }
  }, vve.statutairenaam)) : vve.statutairenaam), vve._verdacht && /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#f59e0b',
      flexShrink: 0,
      fontSize: 11
    },
    title: `Brondata: ${vve._brondata_aantal}, werkelijk: ${vve._werkelijk_aantal}`
  }, "⚠"), noKvk && /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontSize: 9,
      background: '#fee2e2',
      color: '#dc2626',
      padding: '1px 4px',
      borderRadius: 2
    }
  }, "KvK?"), isHoofdsplitsing(vve) && /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontSize: 9,
      background: '#e8eefc',
      color: '#3450a8',
      padding: '1px 4px',
      borderRadius: 2
    },
    title: HOOFDSPLITSING_UITLEG
  }, "hoofdsplitsing"), (typeof NEW_VVES !== 'undefined' && NEW_VVES.has(vve.vve_identificatie)) && /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontSize: 9,
      background: '#dcfce7',
      color: '#15803d',
      padding: '1px 5px',
      borderRadius: 2,
      fontWeight: 700,
      letterSpacing: '0.04em'
    }
  }, "NIEUW"), crmRecord && crmRecord.status !== 'nieuw' && /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: '#6366f1',
      display: 'inline-block'
    },
    title: `CRM: ${crmRecord.status}`
  }), enrichment && !enrichment.nickname && /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: '#217346',
      display: 'inline-block'
    },
    title: "Heeft dossierdata"
  }), enrichment?.nickname && /*#__PURE__*/React.createElement("span", {
    className: "xl-note-triangle",
    "data-nickname": enrichment.nickname
  })), MAPNAMEN_AAN && (() => {
    var naam = getMapnaam(vve.vve_identificatie);
    var url = dossierUrl(vve.vve_identificatie);
    var tekst = [naam.replace(/ \((KvK \d{8}|\d{9})\)$/, ''), /*#__PURE__*/React.createElement("span", {
      key: "id",
      className: "xl-map-id"
    }, (naam.match(/\((KvK \d{8}|\d{9})\)$/) || ['', ''])[1])];
    return /*#__PURE__*/React.createElement("div", {
      className: "xl-cell xl-cell-map" + (url ? "" : " xl-cell-map-kopie"),
      title: naam + (url ? '\nKlik om de map te openen' : '\nKlik om te kopi\u00EBren\n(map openen niet beschikbaar: geen dossierlocatie in team_config.js)'),
      onClick: e => url ? e.stopPropagation() : kopieerMapnaam(e, naam)
    }, url ? /*#__PURE__*/React.createElement("a", {
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "truncate xl-map-link",
      onClick: e => e.stopPropagation()
    }, tekst) : /*#__PURE__*/React.createElement("span", {
      className: "truncate"
    }, tekst), url && /*#__PURE__*/React.createElement("a", {
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "xl-map-open",
      title: "Map openen",
      onClick: e => e.stopPropagation()
    }, "\u2197"), url && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "xl-map-kopieer",
      title: "Mapnaam kopi\u00EBren",
      onClick: e => kopieerMapnaam(e, naam)
    }, "\u29C9"));
  })(), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell xl-cell-center",
    style: {
      color: '#444'
    },
    title: adresTelling(vve)
  }, vve.aantal_woon_adr_in_vve), /*#__PURE__*/React.createElement("div", {
    className: `xl-cell xl-cell-center font-medium ${getEnergyClass(avgEnergy)}`
  }, avgEnergy), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell",
    style: {
      color: '#555',
      fontSize: 11
    }
  }, vve.buurt), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell xl-cell-center",
    style: {
      color: '#888',
      fontSize: 11
    }
  }, vve.bouwjaar_gerelateerd_pand || ''), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell xl-cell-right",
    style: {
      color: '#555',
      fontSize: 11
    }
  }, formatCurrency(avgWoz)), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell",
    style: {
      fontSize: 10,
      color: '#555'
    }
  }, warmte?.tijdvak || ''), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell",
    style: {
      fontSize: 10,
      color: '#555'
    }
  }, (getWarmteProg(vve) || {}).warmte || ''), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell",
    style: {
      fontSize: 10,
      color: '#777'
    }
  }, vve.wijk || ''), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell xl-cell-center",
    title: vve.monumentale_status || ''
  }, vve.monumentale_status ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: '#92400e'
    },
    title: vve.monumentale_status
  }, "✓") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#e5e7eb'
    }
  }, "–")), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell xl-cell-center",
    title: beschermd ? `Beschermd stadsgezicht ${beschermd}` : ''
  }, beschermd ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: '#1d4ed8'
    },
    title: `Beschermd stadsgezicht ${beschermd}`
  }, "✓") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#e5e7eb'
    }
  }, "–")), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell xl-cell-center",
    title: (vve.aantal_niet_woon_adr_in_vve || 0) > 0 ? `${vve.aantal_niet_woon_adr_in_vve} niet-woon adres(sen)` : ''
  }, (vve.aantal_niet_woon_adr_in_vve || 0) > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: '#b45309'
    }
  }, "✓") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#e5e7eb'
    }
  }, "–")), dossierVisible && /*#__PURE__*/React.createElement("div", {
    className: "xl-cell xl-cell-center",
    title: enrichment?.adviestraject || ''
  }, enrichment?.adviestraject ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: '#217346'
    },
    title: enrichment.adviestraject
  }, "✓") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#e5e7eb'
    }
  }, "–")), dossierVisible && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "xl-cell",
    style: {
      fontSize: 11,
      color: '#444'
    }
  }, enrichment?.bureau || ''), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell xl-cell-center",
    style: {
      fontSize: 11,
      color: '#444'
    }
  }, enrichment?.intake || ''), /*#__PURE__*/React.createElement("div", {
    className: "xl-cell",
    style: {
      fontSize: 11,
      color: '#444'
    }
  }, enrichment?.beheerder || ''))), isExpanded && sortedAddresses.map(item => /*#__PURE__*/React.createElement(AddressCard, {
    key: item.id,
    item: item,
    onClick: onSelectItem,
    selected: selectedItem?.id === item.id,
    colTemplate: colTemplate,
    dossierVisible: dossierVisible,
    activeWozJaar: activeWozJaar
  })));
};
var getMonumentLabel = status => {
  if (!status || status.toLowerCase().includes('geen') || status.toLowerCase().includes('waarschijnlijk')) {
    return null;
  }
  return status;
};
var HerbouwwaardeModal = function(_ref_hw) {
  var item = _ref_hw.item, vveAddresses = _ref_hw.vveAddresses, onClose = _ref_hw.onClose;
  var E = React.createElement;
  var woonAdr = vveAddresses.filter(function(a){var t=(a.basiseenheidtype||'').toLowerCase();return t.includes('woning')||t.includes('appartement');});
  var ONVERWARMD_BVO = new Set(['garage(box)','berging/opslag','trafo','technische ruimte']);
  var verwarmdAdr = vveAddresses.filter(function(a){return !ONVERWARMD_BVO.has(a.basiseenheidtype||'');});
  var bouwjarenRaw = vveAddresses.map(function(a){return parseInt(a.bouwjaar_gerelateerd_pand);}).filter(function(n){return !isNaN(n)&&n>1800;}).sort(function(a,b){return a-b;});
  var bouwjaarDefault = bouwjarenRaw[0]||1975;
  var aantalAppDefault = item.aantal_woon_adr_in_vve||woonAdr.length||1;
  var opps = verwarmdAdr.map(function(a){return parseFloat(a.oppervlakte);}).filter(function(n){return !isNaN(n)&&n>20;});
  var heeftNietWoon = verwarmdAdr.some(function(a){var t=(a.basiseenheidtype||'').toLowerCase();return !t.includes('woning')&&!t.includes('appartement');});
  var bvoDefault = opps.length>0?Math.round(opps.reduce(function(s,v){return s+v;},0)*1.25):aantalAppDefault*85;
  var bvoSource = opps.length>0?(heeftNietWoon?'Som alle eenheden (incl. bedrijfsruimte) \xd7 1,25':'Som woningoppervlaktes \xd7 1,25')+' — excl. bergingen/garages':aantalAppDefault+' app. \xd7 85 m\xb2 (schatting)';
  var bouwlaagNums = vveAddresses.map(function(a){return a.hoogste_bouwlaag;}).filter(function(n){return n!=null&&!isNaN(n);});
  var laagsteNums = vveAddresses.map(function(a){return a.laagste_bouwlaag;}).filter(function(n){return n!=null&&!isNaN(n);});
  var maxBouwlaag = bouwlaagNums.length>0?Math.max.apply(null,bouwlaagNums):-1;
  var minBouwlaag = laagsteNums.length>0?Math.min.apply(null,laagsteNums):0;
  var verdiepingenDefault = maxBouwlaag>=0?(maxBouwlaag-Math.max(0,minBouwlaag)+1):3;
  var verdiepingenSource = bouwlaagNums.length>0?'Afgeleid van BAG bouwlagen (max '+maxBouwlaag+', min '+minBouwlaag+')':'Schatting';
  var heeftLiftDefault = verdiepingenDefault>=4;
  var aantalLiftDefault = verdiepingenDefault>=8?2:1;
  var _ms=(item.monumentale_status||'').toLowerCase().trim();
  var monumentDefault = !!(_ms&&_ms!=='-'&&!_ms.includes('geen')&&!_ms.includes('waarschijnlijk'));
  var centrumDefault = item.stadsdeel==='Centrum'||item.wijk==='Oude Stad';
  var _s1=useState(bvoDefault),_s1a=_slicedToArray(_s1,2),opp=_s1a[0],setOpp=_s1a[1];
  var _s2=useState(aantalAppDefault),_s2a=_slicedToArray(_s2,2),aantalApp=_s2a[0],setAantalApp=_s2a[1];
  var _s3=useState(verdiepingenDefault),_s3a=_slicedToArray(_s3,2),verdiepingen=_s3a[0],setVerdiepingen=_s3a[1];
  var _s4=useState(bouwjaarDefault),_s4a=_slicedToArray(_s4,2),bouwjaar=_s4a[0],setBouwjaar=_s4a[1];
  var _s5=useState('1.15'),_s5a=_slicedToArray(_s5,2),kwaliteit=_s5a[0],setKwaliteit=_s5a[1];
  var _s6=useState(monumentDefault),_s6a=_slicedToArray(_s6,2),monument=_s6a[0],setMonument=_s6a[1];
  var _s7=useState(heeftLiftDefault),_s7a=_slicedToArray(_s7,2),heeftLift=_s7a[0],setHeeftLift=_s7a[1];
  var _s8=useState(aantalLiftDefault),_s8a=_slicedToArray(_s8,2),aantalLift=_s8a[0],setAantalLift=_s8a[1];
  var _s9=useState(false),_s9a=_slicedToArray(_s9,2),heeftGarage=_s9a[0],setHeeftGarage=_s9a[1];
  var _s10=useState(6),_s10a=_slicedToArray(_s10,2),aantalPlekken=_s10a[0],setAantalPlekken=_s10a[1];
  var _s11=useState(centrumDefault),_s11a=_slicedToArray(_s11,2),centrum=_s11a[0],setCentrum=_s11a[1];
  var _s12=useState('1.00'),_s12a=_slicedToArray(_s12,2),onderhoudPct=_s12a[0],setOnderhoudPct=_s12a[1];
  var calc = useMemo(function(){
    var BP=1850,pc=item.postcode||'',d=(pc.match(/\d/g)||[]).join('');
    var rm={'1':1.08,'2':1.08,'3':1.06,'4':1.00,'5':1.00,'6':0.97,'7':0.97,'8':0.97,'9':0.94};
    var regio=d?(rm[d[0]]!==undefined?rm[d[0]]:1.0):1.0;
    var hoogbouw=verdiepingen>10?1.15:verdiepingen>4?1.08:1.0;
    var kw=parseFloat(kwaliteit)||1.15;
    var basis=opp*BP,naRegio=basis*regio,naHoogbouw=naRegio*hoogbouw,naKwaliteit=naHoogbouw*kw,naMonument=naKwaliteit*(monument?1.40:1.0),naCentrum=naMonument*(centrum?1.08:1.0);
    var perEenheid=aantalApp*3500,liftK=heeftLift?aantalLift*28000:0,garageK=heeftGarage?aantalPlekken*17500:0;
    var sub=naCentrum+perEenheid+liftK+garageK,sloop=sub*0.05,bijkomend=(sub+sloop)*0.10,exclBtw=sub+sloop+bijkomend,btw=exclBtw*0.21,totaal=exclBtw+btw;
    var mjopJaar=totaal*(parseFloat(onderhoudPct)*0.01),mjopApp=aantalApp>0?mjopJaar/aantalApp:0;
    var bd=[
      ['Basis (BVO \xd7 basisprijs/m\xb2)',basis],
      regio!==1.0?['Regio-index ('+regio.toFixed(2)+'\xd7)',naRegio-basis]:null,
      verdiepingen>4?['Bouwhoogte-toeslag ('+verdiepingen+' lagen)',naHoogbouw-naRegio]:null,
      kw!==1.0?['Kwaliteitsniveau ('+kw.toFixed(2)+'\xd7)',naKwaliteit-naHoogbouw]:null,
      monument?['Monumentale status (+40%)',naMonument-naKwaliteit]:null,
      centrum?['Binnenstad-opslag (+8%)',naCentrum-naMonument]:null,
      ['Installaties p/app ('+aantalApp+'\xd7)',perEenheid],
      heeftLift?['Lift(en) ('+aantalLift+'\xd7)',liftK]:null,
      heeftGarage?['Parkeergarage ('+aantalPlekken+' pl.)',garageK]:null,
      ['Sloopkosten (5%)',sloop],
      ['Bijkomende kosten (10%)',bijkomend],
      ['BTW (21%)',btw],
    ].filter(Boolean);
    return {totaal,perM2:opp>0?totaal/opp:0,bd,mjopJaar,mjopApp,mjopMaand:mjopApp/12};
  },[opp,aantalApp,verdiepingen,kwaliteit,monument,centrum,heeftLift,aantalLift,heeftGarage,aantalPlekken,onderhoudPct,item.postcode]);
  var fmtEUR=function(n){return new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);};
  var iCls='border border-pa-gray-300 px-2 py-1 text-xs font-mono';
  var sBtn='w-6 h-6 border border-pa-gray-300 bg-white text-xs hover:bg-pa-gray-50 flex items-center justify-center';
  var field=function(num,lbl,hint,ctrl){return E('div',{className:'py-2.5 border-b border-pa-gray-100'},
    E('div',{className:'flex gap-2 items-baseline mb-1.5'},
      E('span',{className:'text-[10px] font-mono text-pa-blue-500 w-5 text-right shrink-0'},num),
      E('span',{className:'text-xs font-semibold text-pa-gray-700'},lbl),
      hint&&E('span',{className:'text-[11px] text-pa-gray-400 ml-1'},'— '+hint)
    ),
    E('div',{className:'ml-7'},ctrl)
  );};
  var rp={background:'#ffffff',color:'#171717',borderRadius:'6px',padding:'16px 14px',overflow:'hidden',position:'relative',border:'1px solid #D4D4D4'};
  return E('div',{className:'fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 p-4 overflow-y-auto',onClick:onClose},
    E('div',{className:'bg-white border border-pa-gray-300 w-full max-w-3xl mt-8 mb-8',style:{boxShadow:'0 20px 60px rgba(0,0,0,0.3)'},onClick:function(e){e.stopPropagation();}},
      E('div',{className:'flex items-start justify-between px-4 py-3 bg-pa-gray-100 border-b border-pa-gray-300'},
        E('div',null,
          E('div',{className:'text-[10px] font-mono uppercase tracking-widest text-pa-blue-500 mb-0.5'},'VvE-dashboard \xb7 module'),
          E('div',{className:'text-sm font-semibold text-pa-gray-800'},'Herbouwwaarde-inschatting — ',E('span',{className:'text-pa-blue-700'},item.statutairenaam||'-')),
          E('div',{className:'text-[11px] text-pa-gray-500 mt-0.5'},'Indicatief \xb7 prijspeil 2026 \xb7 incl. BTW en bijkomende kosten')
        ),
        E('button',{onClick:onClose,className:'p-1 hover:bg-pa-gray-200 text-pa-gray-500 shrink-0 ml-3'},
          E('svg',{className:'w-4 h-4',fill:'none',stroke:'currentColor',viewBox:'0 0 24 24'},E('path',{strokeLinecap:'round',strokeLinejoin:'round',strokeWidth:2,d:'M6 18L18 6M6 6l12 12'}))
        )
      ),
      E('div',{className:'mx-4 mt-3 px-3 py-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 leading-snug'},
        E('strong',null,'Let op: '),'grove indicatie o.b.v. kengetallen — geen taxatierapport. Laat de herbouwwaarde periodiek toetsen door een erkend taxateur.'
      ),
      E('div',{className:'flex gap-0',style:{padding:'16px',alignItems:'start'}},
        E('div',{className:'flex-1 min-w-0',style:{paddingRight:'16px'}},
          field('01','Bruto vloeroppervlak (BVO)',bvoSource,
            E('div',{className:'flex items-center gap-2'},
              E('input',{type:'number',value:opp,min:0,onChange:function(e){setOpp(parseFloat(e.target.value)||0);},className:iCls+' w-36'}),
              E('span',{className:'text-xs text-pa-gray-500'},'m\xb2')
            )
          ),
          field('02','Aantal appartementen','Uit VvE-data',
            E('div',{className:'flex items-center gap-1'},
              E('button',{type:'button',onClick:function(){setAantalApp(function(v){return Math.max(1,v-1);});},className:sBtn},'−'),
              E('input',{type:'number',value:aantalApp,min:1,onChange:function(e){setAantalApp(parseInt(e.target.value)||1);},className:iCls+' w-14 text-center'}),
              E('button',{type:'button',onClick:function(){setAantalApp(function(v){return v+1;});},className:sBtn},'+')
            )
          ),
          field('03','Aantal bouwlagen',verdiepingenSource,
            E('div',{className:'flex flex-col gap-1'},
              E('div',{className:'flex items-center gap-1'},
                E('button',{type:'button',onClick:function(){setVerdiepingen(function(v){return Math.max(1,v-1);});},className:sBtn},'−'),
                E('input',{type:'number',value:verdiepingen,min:1,onChange:function(e){setVerdiepingen(parseInt(e.target.value)||1);},className:iCls+' w-14 text-center'}),
                E('button',{type:'button',onClick:function(){setVerdiepingen(function(v){return v+1;});},className:sBtn},'+')
              ),
              minBouwlaag<0&&E('div',{className:'text-[10px] text-amber-600 flex items-center gap-1'},
                '⚠ souterrain/benedenwoning aanwezig in BAG-data (niet meegeteld in bouwlagen)'
              )
            )
          ),
          field('04','Bouwjaar','Uit VvE-data (pand)',
            E('input',{type:'number',value:bouwjaar,min:1800,max:2026,onChange:function(e){setBouwjaar(parseInt(e.target.value)||1975);},className:iCls+' w-28'})
          ),
          field('05','Staat van onderhoud',null,
            E('select',{value:onderhoudPct,onChange:function(e){setOnderhoudPct(e.target.value);},className:'border border-pa-gray-300 px-2 py-1 text-xs w-full pr-6'},
              E('option',{value:'0.50'},'Uitstekend — 0,5% (wettelijk minimum)'),
              E('option',{value:'0.75'},'Goed — 0,75%'),
              E('option',{value:'1.00'},'Normaal — 1,0% (gangbare norm)'),
              E('option',{value:'1.50'},'Achterstand — 1,5%'),
              E('option',{value:'2.00'},'Grote achterstand — 2,0%')
            )
          ),
          field('06','Kwaliteitsniveau afwerking',null,
            E('select',{value:kwaliteit,onChange:function(e){setKwaliteit(e.target.value);},className:'border border-pa-gray-300 px-2 py-1 text-xs pr-6'},
              E('option',{value:'1.0'},'Standaard'),
              E('option',{value:'1.15'},'Goed / bovenmodaal'),
              E('option',{value:'1.35'},'Luxe')
            )
          ),
          field('07','Bijzondere kenmerken',null,
            E('div',{className:'flex flex-col gap-1.5'},
              E('label',{className:'flex items-center gap-2 text-xs px-2 py-1.5 bg-pa-gray-50 border border-pa-gray-200 cursor-pointer'},
                E('input',{type:'checkbox',checked:monument,onChange:function(e){setMonument(e.target.checked);},className:'accent-blue-600'}),
                'Rijks- of gemeentelijk monument',
                monumentDefault&&E('span',{className:'text-[10px] text-amber-600 font-mono ml-auto'},'⚠ VvE-data')
              ),
              E('label',{className:'flex items-center gap-2 text-xs px-2 py-1.5 bg-pa-gray-50 border border-pa-gray-200 cursor-pointer'},
                E('input',{type:'checkbox',checked:centrum,onChange:function(e){setCentrum(e.target.checked);},className:'accent-blue-600'}),
                'Binnenstad / historisch centrum (+8%)',
                centrumDefault&&E('span',{className:'text-[10px] text-pa-blue-500 font-mono ml-auto'},'⚙ stadsdeel')
              ),
              E('label',{className:'flex items-center gap-2 text-xs px-2 py-1.5 bg-pa-gray-50 border border-pa-gray-200 cursor-pointer'},
                E('input',{type:'checkbox',checked:heeftLift,onChange:function(e){setHeeftLift(e.target.checked);},className:'accent-blue-600'}),
                'Lift(en)',
                heeftLiftDefault&&E('span',{className:'text-[10px] text-pa-blue-500 font-mono ml-auto'},'≥'+verdiepingenDefault+' lagen')
              ),
              heeftLift&&E('div',{className:'flex items-center gap-1.5 ml-4 text-[11px] text-pa-gray-600'},
                'Aantal:',
                E('button',{type:'button',onClick:function(){setAantalLift(function(v){return Math.max(1,v-1);});},className:sBtn},'−'),
                E('span',{className:'font-mono font-semibold w-4 text-center'},aantalLift),
                E('button',{type:'button',onClick:function(){setAantalLift(function(v){return v+1;});},className:sBtn},'+')
              ),
              E('label',{className:'flex items-center gap-2 text-xs px-2 py-1.5 bg-pa-gray-50 border border-pa-gray-200 cursor-pointer'},
                E('input',{type:'checkbox',checked:heeftGarage,onChange:function(e){setHeeftGarage(e.target.checked);},className:'accent-blue-600'}),
                'Ondergrondse parkeergarage'
              ),
              heeftGarage&&E('div',{className:'flex items-center gap-1.5 ml-4 text-[11px] text-pa-gray-600'},
                'Plekken:',
                E('button',{type:'button',onClick:function(){setAantalPlekken(function(v){return Math.max(1,v-1);});},className:sBtn},'−'),
                E('span',{className:'font-mono font-semibold w-6 text-center'},aantalPlekken),
                E('button',{type:'button',onClick:function(){setAantalPlekken(function(v){return v+1;});},className:sBtn},'+')
              )
            )
          ),
        ),
        E('div',{className:'w-56 shrink-0',style:{position:'sticky',top:'8px'}},
          E('div',{style:rp},
            E('div',{style:{position:'absolute',top:'12px',right:'-38px',background:'#B5652E',color:'#fff',fontSize:'9px',letterSpacing:'0.12em',textTransform:'uppercase',padding:'3px 44px',transform:'rotate(35deg)'}},'indicatie'),
            E('div',{style:{fontSize:'10px',letterSpacing:'0.12em',textTransform:'uppercase',color:'#0078d4',marginBottom:'6px',fontWeight:600}},'Herbouwwaarde'),
            E('div',{style:{fontSize:'22px',fontWeight:700,letterSpacing:'-0.01em',fontVariantNumeric:'tabular-nums',marginBottom:'2px',color:'#171717'}},opp>0?fmtEUR(calc.totaal):'—'),
            E('div',{style:{fontSize:'11px',color:'#737373',marginBottom:'8px'}},opp>0?fmtEUR(calc.totaal*0.85)+' – '+fmtEUR(calc.totaal*1.15):'bandbreedte \xb115%'),
            E('div',{style:{fontSize:'11px',fontFamily:'monospace',color:'#0078d4',background:'#eff6ff',display:'inline-block',padding:'3px 8px',borderRadius:'4px',marginBottom:'14px',border:'1px solid #bfdbfe'}},
              opp>0?fmtEUR(calc.perM2)+' / m\xb2 BVO':'— / m\xb2'
            ),
            E('table',{style:{width:'100%',borderCollapse:'collapse',fontSize:'11px'}},
              ...calc.bd.map(function(_rw){return E('tr',{key:_rw[0],style:{borderBottom:'1px solid #e5e5e5'}},
                E('td',{style:{padding:'4px 0',color:'#525252',paddingRight:'4px',lineHeight:'1.3'}},_rw[0]),
                E('td',{style:{padding:'4px 0',textAlign:'right',fontFamily:'monospace',whiteSpace:'nowrap',color:'#171717'}},fmtEUR(_rw[1]))
              );}),
              E('tr',null,
                E('td',{style:{padding:'8px 0 4px',fontWeight:700,color:'#171717',borderTop:'2px solid #171717'}},'Totaal'),
                E('td',{style:{padding:'8px 0 4px',textAlign:'right',fontWeight:700,fontFamily:'monospace',color:'#171717',whiteSpace:'nowrap',borderTop:'2px solid #171717'}},opp>0?fmtEUR(calc.totaal):'—')
              )
            )
          ),
          E('div',{style:{background:'#fafafa',color:'#171717',borderRadius:'6px',padding:'14px 14px',marginTop:'8px',border:'1px solid #D4D4D4'}},
            E('div',{style:{fontSize:'10px',letterSpacing:'0.12em',textTransform:'uppercase',color:'#0078d4',fontWeight:600,marginBottom:'10px'}},'MJOP spaarbedrag'),
            E('table',{style:{width:'100%',borderCollapse:'collapse',marginBottom:'10px'}},
              E('tbody',null,
                E('tr',null,
                  E('td',{style:{fontSize:'11px',color:'#525252',paddingBottom:'6px',verticalAlign:'middle'}},'Totaal / jaar'),
                  E('td',{style:{fontSize:'19px',fontWeight:700,fontFamily:'monospace',fontVariantNumeric:'tabular-nums',textAlign:'right',letterSpacing:'-0.01em',paddingBottom:'6px',verticalAlign:'middle',whiteSpace:'nowrap',color:'#171717'}},opp>0?fmtEUR(calc.mjopJaar):'—')
                ),
                E('tr',null,
                  E('td',{style:{fontSize:'11px',color:'#525252',paddingTop:'6px',borderTop:'1px solid #e5e5e5',verticalAlign:'middle'}},'Per app. / maand'),
                  E('td',{style:{fontSize:'19px',fontWeight:700,fontFamily:'monospace',fontVariantNumeric:'tabular-nums',textAlign:'right',letterSpacing:'-0.01em',paddingTop:'6px',borderTop:'1px solid #e5e5e5',verticalAlign:'middle',whiteSpace:'nowrap',color:'#171717'}},opp>0?fmtEUR(calc.mjopMaand):'—')
                )
              )
            ),
            E('div',{style:{fontSize:'11px',color:'#737373',lineHeight:'1.5'}},
              onderhoudPct+'% herbouwwaarde/jaar. '+({'0.50':'Wettelijk minimum — alleen bij uitstekend onderhoud.','0.75':'Gunstige inschatting — alleen haalbaar bij goed onderhoud.','1.00':'Gangbare VvE-norm.','1.50':'Verhoogd spaartarief i.v.m. onderhoudsachterstand.','2.00':'Inhaalslag vereist — directe actie aanbevolen.'}[onderhoudPct]||'')
            )
          )
        )
      )
    )
  );
};
var _GEO_ZONES=[{"n":"Zijlweg","g":{"type":"Polygon","coordinates":[[[4.6133,52.3862],[4.6133,52.3861],[4.6136,52.3861],[4.6135,52.3858],[4.6143,52.3856],[4.6151,52.3854],[4.6151,52.3853],[4.6151,52.385],[4.6151,52.3848],[4.6152,52.3845],[4.6152,52.3844],[4.6154,52.3844],[4.6159,52.3843],[4.616,52.3844],[4.6161,52.3846],[4.6163,52.3849],[4.6171,52.3859],[4.6167,52.386],[4.6168,52.3863],[4.6168,52.3863],[4.6168,52.3863],[4.6167,52.3863],[4.6167,52.3864],[4.6168,52.3865],[4.6172,52.3864],[4.6173,52.3865],[4.6173,52.3866],[4.6173,52.3866],[4.6175,52.3869],[4.6174,52.3869],[4.6176,52.3871],[4.6176,52.3871],[4.6176,52.3872],[4.6177,52.3873],[4.6179,52.3874],[4.6182,52.3873],[4.6185,52.3877],[4.6189,52.3884],[4.6177,52.3886],[4.6166,52.3888],[4.6162,52.3888],[4.6144,52.3891],[4.6142,52.3892],[4.6141,52.389],[4.6138,52.3883],[4.6137,52.3881],[4.6136,52.3879],[4.6139,52.3879],[4.6139,52.3878],[4.6139,52.3878],[4.6138,52.3873],[4.6138,52.3871],[4.6139,52.3871],[4.6138,52.387],[4.6138,52.3869],[4.6136,52.3866],[4.6135,52.3865],[4.6133,52.3862]]]}},{"n":"Planetenlaan/Orionweg","g":{"type":"Polygon","coordinates":[[[4.6504,52.41],[4.6503,52.4101],[4.6497,52.4106],[4.6488,52.4113],[4.6484,52.4116],[4.648,52.4118],[4.6476,52.412],[4.6467,52.4125],[4.6461,52.4128],[4.6459,52.4127],[4.646,52.4127],[4.646,52.4126],[4.6459,52.4126],[4.6456,52.4123],[4.645,52.4119],[4.6448,52.4117],[4.6445,52.4115],[4.6442,52.4114],[4.6439,52.4112],[4.6436,52.4111],[4.6431,52.411],[4.6426,52.4109],[4.6422,52.4108],[4.642,52.4107],[4.6412,52.4104],[4.6412,52.4104],[4.641,52.4103],[4.6412,52.4102],[4.6417,52.4097],[4.6418,52.4096],[4.6419,52.4095],[4.6423,52.4092],[4.6426,52.4089],[4.6428,52.4088],[4.643,52.4086],[4.6431,52.4086],[4.6435,52.4083],[4.6439,52.408],[4.6438,52.408],[4.6438,52.408],[4.6436,52.4079],[4.6435,52.4078],[4.6431,52.4078],[4.6429,52.4077],[4.6426,52.4076],[4.6419,52.4073],[4.6417,52.4073],[4.6415,52.4072],[4.6415,52.4072],[4.6411,52.4074],[4.6408,52.4072],[4.6405,52.407],[4.6403,52.4069],[4.6398,52.4066],[4.6393,52.4063],[4.6388,52.4065],[4.6387,52.4066],[4.6385,52.4067],[4.6383,52.4067],[4.6376,52.4069],[4.6371,52.407],[4.6367,52.4071],[4.6357,52.4072],[4.635,52.4074],[4.6341,52.4075],[4.6339,52.4075],[4.6339,52.4074],[4.6338,52.4072],[4.6337,52.4072],[4.6337,52.4071],[4.6336,52.407],[4.6336,52.407],[4.6334,52.407],[4.6325,52.4071],[4.6323,52.4071],[4.6319,52.4072],[4.6316,52.4072],[4.631,52.4073],[4.631,52.4074],[4.631,52.4074],[4.6311,52.4075],[4.6311,52.4076],[4.6312,52.4077],[4.6313,52.4077],[4.6306,52.4077],[4.6305,52.4077],[4.6304,52.4077],[4.6303,52.4078],[4.6302,52.4076],[4.6297,52.4077],[4.6296,52.4077],[4.6294,52.4073],[4.6293,52.407],[4.6292,52.407],[4.6292,52.4069],[4.6294,52.4068],[4.6301,52.4067],[4.6301,52.4066],[4.6299,52.4063],[4.6302,52.4062],[4.6328,52.4059],[4.6334,52.4057],[4.6337,52.4062],[4.6338,52.4064],[4.6339,52.4065],[4.6344,52.4064],[4.6345,52.4064],[4.6345,52.4065],[4.6367,52.4061],[4.637,52.406],[4.6375,52.4058],[4.6383,52.4056],[4.639,52.4052],[4.6394,52.4049],[4.6396,52.4051],[4.6397,52.4051],[4.6403,52.4055],[4.6401,52.4057],[4.6403,52.4058],[4.6406,52.4059],[4.6407,52.406],[4.6409,52.4061],[4.641,52.4061],[4.6416,52.4063],[4.6421,52.4065],[4.6425,52.4066],[4.6442,52.4072],[4.6448,52.4074],[4.647,52.4081],[4.6473,52.4077],[4.6478,52.4072],[4.6479,52.4072],[4.6486,52.4074],[4.6488,52.4074],[4.6488,52.4073],[4.6491,52.4073],[4.6492,52.4074],[4.6495,52.4074],[4.6496,52.4073],[4.6496,52.4073],[4.6499,52.4078],[4.65,52.408],[4.6501,52.4083],[4.6503,52.4086],[4.6504,52.4089],[4.6504,52.4089],[4.6507,52.4089],[4.6509,52.4091],[4.6513,52.409],[4.6515,52.4092],[4.6514,52.4093],[4.6513,52.4094],[4.6511,52.4096],[4.6511,52.4096],[4.6511,52.4096],[4.6511,52.4097],[4.6511,52.4097],[4.6511,52.4097],[4.6511,52.4098],[4.6511,52.4098],[4.6511,52.4098],[4.6512,52.4098],[4.6512,52.4098],[4.6512,52.4098],[4.6509,52.41],[4.6509,52.4099],[4.6508,52.4098],[4.6508,52.4098],[4.6504,52.41]]]}},{"n":"Spoorzone Zuid-West","g":{"type":"Polygon","coordinates":[[[4.6118,52.3642],[4.6115,52.3643],[4.6117,52.3645],[4.6115,52.3646],[4.6121,52.3655],[4.6123,52.3654],[4.6125,52.3656],[4.6124,52.3656],[4.6126,52.3659],[4.6132,52.3658],[4.6134,52.366],[4.6129,52.3661],[4.6124,52.3662],[4.6121,52.3663],[4.6118,52.3664],[4.6116,52.3664],[4.6124,52.3678],[4.6124,52.3678],[4.6124,52.3678],[4.6124,52.3679],[4.6124,52.3679],[4.6125,52.3679],[4.6125,52.3679],[4.6126,52.3678],[4.6126,52.3678],[4.6128,52.3678],[4.6128,52.3678],[4.613,52.3677],[4.613,52.3678],[4.613,52.3678],[4.613,52.3679],[4.613,52.3679],[4.6131,52.3679],[4.6131,52.3679],[4.6132,52.3681],[4.6133,52.3684],[4.6136,52.3689],[4.614,52.3697],[4.6146,52.3696],[4.6148,52.37],[4.6147,52.37],[4.6151,52.3707],[4.6152,52.3709],[4.6152,52.3709],[4.6153,52.3711],[4.6153,52.3712],[4.6149,52.3713],[4.615,52.3715],[4.6153,52.3715],[4.6154,52.3717],[4.6155,52.372],[4.6155,52.372],[4.6155,52.3721],[4.6156,52.3721],[4.6155,52.3723],[4.6154,52.3724],[4.6154,52.3724],[4.6154,52.3724],[4.6154,52.3724],[4.6154,52.3724],[4.6156,52.3728],[4.6159,52.3734],[4.616,52.3735],[4.6161,52.3736],[4.6165,52.3735],[4.6166,52.3735],[4.6171,52.3735],[4.6172,52.3735],[4.6172,52.3735],[4.6173,52.3736],[4.6173,52.3737],[4.6173,52.3738],[4.6174,52.3739],[4.6174,52.374],[4.6175,52.3742],[4.6176,52.3743],[4.6177,52.3747],[4.6178,52.3748],[4.6179,52.3751],[4.618,52.3752],[4.6182,52.3756],[4.6183,52.3757],[4.6183,52.3758],[4.6185,52.376],[4.6188,52.3764],[4.6189,52.3767],[4.6192,52.377],[4.6198,52.3778],[4.6199,52.3779],[4.6204,52.3784],[4.6175,52.3794],[4.6168,52.378],[4.6155,52.3755],[4.6152,52.3747],[4.615,52.3743],[4.6149,52.3741],[4.6146,52.3735],[4.614,52.3723],[4.6136,52.3718],[4.6135,52.3716],[4.6127,52.3702],[4.612,52.3688],[4.6119,52.3689],[4.6118,52.3686],[4.6109,52.3669],[4.6104,52.367],[4.6105,52.3671],[4.6101,52.3672],[4.61,52.3671],[4.6099,52.3671],[4.608,52.3675],[4.6079,52.3672],[4.6078,52.367],[4.6074,52.3671],[4.607,52.3667],[4.6067,52.3662],[4.6064,52.3657],[4.6063,52.3653],[4.6064,52.3651],[4.6064,52.3649],[4.6064,52.3648],[4.6063,52.3646],[4.606,52.3643],[4.6057,52.3639],[4.6057,52.3636],[4.6057,52.3634],[4.6069,52.3632],[4.6071,52.3632],[4.6082,52.363],[4.6083,52.363],[4.6087,52.3629],[4.6089,52.3629],[4.6092,52.3628],[4.6092,52.3629],[4.6094,52.3633],[4.6094,52.3633],[4.6095,52.3635],[4.6102,52.3633],[4.611,52.3632],[4.612,52.3642],[4.6118,52.3642]]]}},{"n":"Spaarnesprong","g":{"type":"Polygon","coordinates":[[[4.6464,52.3853],[4.646,52.3851],[4.6451,52.3848],[4.6449,52.3847],[4.6434,52.3843],[4.6433,52.3843],[4.6432,52.3842],[4.6428,52.3841],[4.6426,52.3839],[4.6425,52.3839],[4.6424,52.3836],[4.6424,52.3835],[4.6425,52.3835],[4.6426,52.3834],[4.6426,52.3834],[4.6427,52.3834],[4.6427,52.3833],[4.6428,52.3833],[4.643,52.3832],[4.6431,52.3831],[4.6433,52.3831],[4.6434,52.383],[4.6436,52.3829],[4.6439,52.3828],[4.6441,52.3827],[4.6447,52.3824],[4.6449,52.3823],[4.6449,52.3823],[4.645,52.3822],[4.6451,52.3821],[4.6452,52.382],[4.6453,52.382],[4.6453,52.3819],[4.6454,52.3818],[4.6454,52.3817],[4.6454,52.3816],[4.6454,52.3815],[4.6454,52.3814],[4.6453,52.3813],[4.6453,52.3812],[4.6452,52.3812],[4.6451,52.3811],[4.645,52.381],[4.6449,52.381],[4.6447,52.3809],[4.6445,52.3807],[4.6442,52.3806],[4.644,52.3805],[4.6437,52.3805],[4.6436,52.3804],[4.6435,52.3804],[4.6434,52.3804],[4.6434,52.3804],[4.6431,52.3803],[4.6431,52.3802],[4.643,52.3802],[4.6431,52.3801],[4.6432,52.38],[4.6432,52.3799],[4.6437,52.38],[4.6437,52.38],[4.6439,52.3801],[4.644,52.3801],[4.6443,52.3801],[4.6443,52.3801],[4.6445,52.3802],[4.6447,52.3802],[4.6449,52.3803],[4.645,52.3804],[4.6452,52.3804],[4.6454,52.3805],[4.6456,52.3806],[4.6458,52.3806],[4.646,52.3807],[4.6461,52.3805],[4.6461,52.3804],[4.6461,52.3804],[4.6462,52.3803],[4.6462,52.3803],[4.6463,52.3803],[4.6464,52.3804],[4.6465,52.3804],[4.6466,52.3805],[4.6467,52.3805],[4.6467,52.3806],[4.6468,52.3806],[4.6468,52.3807],[4.6469,52.3808],[4.6469,52.3809],[4.6469,52.3809],[4.6469,52.381],[4.6475,52.381],[4.6475,52.3811],[4.6475,52.3811],[4.6475,52.3812],[4.6475,52.3812],[4.6474,52.3812],[4.6474,52.3812],[4.6473,52.3812],[4.6473,52.3813],[4.6473,52.3815],[4.6474,52.3816],[4.6475,52.3819],[4.6477,52.3824],[4.6487,52.3822],[4.6493,52.3832],[4.6494,52.3832],[4.6495,52.3833],[4.6495,52.3834],[4.6496,52.3834],[4.6499,52.3835],[4.6498,52.3835],[4.6499,52.3836],[4.65,52.3836],[4.6501,52.3836],[4.6502,52.3837],[4.6503,52.3837],[4.6504,52.3837],[4.6504,52.3838],[4.6505,52.3838],[4.6506,52.3839],[4.6506,52.3839],[4.6507,52.384],[4.6508,52.384],[4.6508,52.3841],[4.6509,52.3841],[4.6509,52.3842],[4.6508,52.3842],[4.6509,52.3843],[4.6503,52.3845],[4.6501,52.3846],[4.6499,52.3847],[4.6497,52.3848],[4.6493,52.385],[4.6492,52.3851],[4.6491,52.3852],[4.6488,52.3853],[4.6481,52.3859],[4.6479,52.3859],[4.6476,52.3857],[4.6468,52.3854],[4.6464,52.3853]]]}},{"n":"Europaweg","g":{"type":"Polygon","coordinates":[[[4.6417,52.3703],[4.6416,52.3703],[4.6416,52.3703],[4.6416,52.3703],[4.6417,52.3691],[4.6431,52.3691],[4.6438,52.3686],[4.6436,52.3681],[4.6444,52.3681],[4.6449,52.3679],[4.6454,52.3679],[4.6463,52.3676],[4.6463,52.367],[4.6465,52.3669],[4.6465,52.3667],[4.6484,52.3667],[4.6484,52.366],[4.6487,52.366],[4.649,52.3651],[4.6489,52.365],[4.6487,52.365],[4.6485,52.365],[4.6483,52.365],[4.6478,52.3649],[4.6478,52.3649],[4.6477,52.3644],[4.6483,52.3644],[4.6487,52.3615],[4.6499,52.3616],[4.6504,52.3593],[4.6506,52.3586],[4.6509,52.3567],[4.6522,52.3568],[4.6522,52.3566],[4.6533,52.3567],[4.6535,52.3563],[4.6534,52.3559],[4.6543,52.3559],[4.6543,52.3554],[4.6547,52.3552],[4.6553,52.3552],[4.6553,52.3556],[4.6564,52.3556],[4.6574,52.3556],[4.6573,52.3608],[4.6548,52.3607],[4.6547,52.3676],[4.6546,52.3679],[4.6546,52.3681],[4.6496,52.368],[4.6495,52.3692],[4.6485,52.3691],[4.6485,52.3701],[4.6458,52.37],[4.6458,52.3704],[4.6433,52.3703],[4.6433,52.3699],[4.6417,52.3703]]]}},{"n":"Spaarndamseweg","g":{"type":"Polygon","coordinates":[[[4.6497,52.3875],[4.6504,52.3876],[4.6506,52.3884],[4.6509,52.3904],[4.6512,52.3916],[4.6515,52.3924],[4.6519,52.3932],[4.6523,52.3943],[4.6526,52.3952],[4.6525,52.3956],[4.6532,52.3963],[4.6542,52.3978],[4.656,52.4003],[4.657,52.4017],[4.6581,52.402],[4.6572,52.4033],[4.6566,52.4042],[4.6568,52.4043],[4.6575,52.4045],[4.658,52.4048],[4.6582,52.4051],[4.6567,52.4056],[4.6554,52.4059],[4.6551,52.4053],[4.6546,52.4044],[4.6543,52.4038],[4.654,52.4037],[4.6537,52.4034],[4.6531,52.4033],[4.6531,52.4031],[4.6529,52.4029],[4.653,52.4029],[4.6533,52.4028],[4.6533,52.4027],[4.6532,52.4026],[4.6531,52.4024],[4.6531,52.4024],[4.6527,52.4025],[4.6524,52.4025],[4.6524,52.4025],[4.6523,52.4024],[4.6521,52.402],[4.6521,52.402],[4.6515,52.4021],[4.6508,52.4009],[4.6504,52.4009],[4.6503,52.4008],[4.6498,52.3998],[4.6495,52.3991],[4.6493,52.3987],[4.6492,52.3985],[4.6491,52.3982],[4.6495,52.3982],[4.6488,52.3966],[4.648,52.3949],[4.6468,52.392],[4.6467,52.392],[4.644,52.3924],[4.6439,52.3922],[4.6436,52.3916],[4.6433,52.3911],[4.643,52.3906],[4.6432,52.3903],[4.6438,52.3904],[4.6448,52.3902],[4.6448,52.3901],[4.645,52.3897],[4.6457,52.3898],[4.6478,52.3896],[4.6477,52.3885],[4.6477,52.388],[4.6476,52.3879],[4.6473,52.388],[4.6473,52.3877],[4.6472,52.3874],[4.6472,52.3868],[4.6472,52.3868],[4.6479,52.3863],[4.6491,52.387],[4.6497,52.3875]]]}},{"n":"Schipholweg","g":{"type":"Polygon","coordinates":[[[4.6416,52.3703],[4.6433,52.3703],[4.6458,52.3704],[4.6458,52.37],[4.6485,52.3701],[4.6485,52.3691],[4.6495,52.3692],[4.6496,52.368],[4.6546,52.3681],[4.6546,52.3679],[4.6659,52.368],[4.6659,52.3698],[4.6659,52.3708],[4.6542,52.3708],[4.6551,52.3718],[4.6528,52.3725],[4.6521,52.3745],[4.6488,52.3744],[4.6491,52.3716],[4.6485,52.3716],[4.6485,52.3717],[4.6478,52.3716],[4.6478,52.3715],[4.6473,52.3715],[4.6473,52.3717],[4.6466,52.3717],[4.6451,52.3714],[4.6452,52.3712],[4.6446,52.371],[4.644,52.3711],[4.6426,52.3713],[4.6422,52.3715],[4.6426,52.3718],[4.6418,52.3722],[4.6401,52.3712],[4.6416,52.3703]]]}},{"n":"Oostpoort","g":{"type":"Polygon","coordinates":[[[4.6654,52.3872],[4.6652,52.3874],[4.6645,52.3873],[4.6649,52.3866],[4.6647,52.3864],[4.6616,52.3856],[4.6611,52.3855],[4.6617,52.3843],[4.6619,52.3838],[4.6633,52.3817],[4.6636,52.3811],[4.6655,52.3814],[4.6664,52.3806],[4.6665,52.3805],[4.667,52.3798],[4.6674,52.3798],[4.6674,52.3801],[4.6678,52.3812],[4.673,52.38],[4.6736,52.381],[4.6741,52.3808],[4.6745,52.3815],[4.6744,52.3817],[4.675,52.3818],[4.6762,52.3822],[4.676,52.3829],[4.6759,52.3833],[4.6759,52.3834],[4.6756,52.3837],[4.6754,52.3839],[4.6749,52.3844],[4.6732,52.386],[4.6727,52.3865],[4.6724,52.3869],[4.6717,52.388],[4.671,52.3879],[4.6707,52.3879],[4.6705,52.3879],[4.6703,52.3879],[4.6701,52.3877],[4.6661,52.3868],[4.6658,52.3867],[4.6657,52.3869],[4.6654,52.3872]]]}}];
var _GEO_MJGB=[{"n":"Rozenprieel-zuid, buurtaanpak","t":"vervanging","s":"2030","e":"2032","g":{"type":"Polygon","coordinates":[[[4.63715,52.37493],[4.63616,52.37498],[4.63476,52.37508],[4.6339,52.37335],[4.63848,52.37214],[4.63861,52.37209],[4.63867,52.37204],[4.63876,52.37194],[4.6388,52.37189],[4.63884,52.37184],[4.63889,52.37181],[4.63914,52.37176],[4.63928,52.37175],[4.6394,52.37173],[4.63953,52.3717],[4.63959,52.37167],[4.63999,52.37144],[4.64113,52.3721],[4.64216,52.37306],[4.64253,52.37366],[4.64271,52.37396],[4.64273,52.37406],[4.6422,52.37409],[4.64089,52.37424],[4.64001,52.37434],[4.63848,52.37452],[4.63814,52.37456],[4.63812,52.37484],[4.63761,52.37486],[4.63715,52.37493]]]}},{"n":"Veldzigt, buurtaanpak","t":"vervanging","s":"2027","e":"2033","g":{"type":"Polygon","coordinates":[[[4.61053,52.38869],[4.61036,52.3887],[4.61008,52.3881],[4.60983,52.38777],[4.61005,52.38769],[4.61033,52.38806],[4.61074,52.38796],[4.61069,52.3879],[4.61102,52.38784],[4.61105,52.3879],[4.61153,52.38781],[4.61149,52.38774],[4.61178,52.3877],[4.61181,52.38775],[4.61225,52.38769],[4.61255,52.38833],[4.61053,52.38869]]]}},{"n":"Rozenprieel-noord, buurtaanpak","t":"vervanging","s":"2030","e":"2032","g":{"type":"Polygon","coordinates":[[[4.64022,52.37676],[4.63998,52.37691],[4.63971,52.37707],[4.63921,52.37675],[4.63909,52.37669],[4.63828,52.37645],[4.63743,52.37619],[4.63715,52.3761],[4.6367,52.37595],[4.63628,52.37592],[4.63514,52.37593],[4.63476,52.37508],[4.63616,52.37498],[4.63715,52.37493],[4.63761,52.37486],[4.63812,52.37484],[4.63814,52.37456],[4.63848,52.37452],[4.64001,52.37434],[4.64089,52.37424],[4.6422,52.37409],[4.64273,52.37406],[4.64286,52.37471],[4.64273,52.37526],[4.64223,52.37585],[4.64139,52.37632],[4.64133,52.37635],[4.6409,52.37651],[4.64052,52.37665],[4.64022,52.37676]]]}},{"n":"Kruistochtbuurt, buurtaanpak","t":"reconstructie","s":"2035","e":"2036","g":{"type":"Polygon","coordinates":[[[4.65069,52.37674],[4.65036,52.37683],[4.65005,52.37687],[4.64972,52.37686],[4.64933,52.37684],[4.64887,52.37681],[4.64801,52.37676],[4.64599,52.37665],[4.64375,52.37649],[4.64345,52.37646],[4.64139,52.37632],[4.64139,52.37632],[4.64223,52.37585],[4.64273,52.37526],[4.64286,52.37471],[4.64273,52.37406],[4.64271,52.37396],[4.64253,52.37366],[4.64349,52.37362],[4.64817,52.37379],[4.6489,52.3738],[4.65028,52.37385],[4.65229,52.37392],[4.6522,52.37422],[4.65209,52.37453],[4.65202,52.37476],[4.65185,52.37565],[4.65177,52.37628],[4.65161,52.3763],[4.65133,52.37643],[4.65115,52.37652],[4.65074,52.37672],[4.65069,52.37674]]]}},{"n":"Van Zeggelenbuurt, buurtaanpak","t":"reconstructie","s":"2036","e":"2037","g":{"type":"Polygon","coordinates":[[[4.6567,52.37934],[4.65587,52.37964],[4.65467,52.37997],[4.65456,52.37954],[4.6543,52.37911],[4.65395,52.37847],[4.65345,52.37802],[4.65242,52.37747],[4.65172,52.37716],[4.65097,52.37711],[4.65074,52.37672],[4.65115,52.37652],[4.65133,52.37643],[4.65161,52.3763],[4.65177,52.37628],[4.65192,52.37625],[4.65248,52.37629],[4.65301,52.37637],[4.65343,52.37642],[4.65376,52.37636],[4.65395,52.3763],[4.65408,52.37611],[4.65445,52.37561],[4.65466,52.37546],[4.65502,52.37534],[4.65549,52.37521],[4.65606,52.37519],[4.65664,52.37521],[4.65715,52.37513],[4.65789,52.37492],[4.65804,52.37487],[4.65831,52.37508],[4.65856,52.37531],[4.65879,52.37558],[4.65899,52.37586],[4.6592,52.37625],[4.65926,52.37638],[4.65941,52.37669],[4.65955,52.37697],[4.65966,52.37721],[4.65978,52.37747],[4.65989,52.37772],[4.65998,52.37792],[4.66009,52.37816],[4.66012,52.37823],[4.66021,52.37842],[4.66025,52.37852],[4.66032,52.37867],[4.6604,52.37886],[4.66043,52.37891],[4.66034,52.37893],[4.66004,52.37897],[4.65982,52.37899],[4.6598,52.37899],[4.65875,52.37909],[4.65713,52.37925],[4.6567,52.37934]]]}},{"n":"Potgieterbuurt, buurtaanpak","t":"reconstructie","s":"2036","e":"2037","g":{"type":"Polygon","coordinates":[[[4.6552,52.38059],[4.65624,52.3807],[4.65614,52.38146],[4.65465,52.38138],[4.65354,52.38131],[4.65302,52.38128],[4.65182,52.38121],[4.65178,52.38121],[4.65184,52.38074],[4.65085,52.37962],[4.64977,52.37835],[4.64932,52.37736],[4.64933,52.37684],[4.64972,52.37686],[4.65005,52.37687],[4.65036,52.37683],[4.65069,52.37674],[4.65074,52.37672],[4.65097,52.37711],[4.65172,52.37716],[4.65242,52.37747],[4.65345,52.37802],[4.65395,52.37847],[4.6543,52.37911],[4.65456,52.37954],[4.65467,52.37997],[4.65468,52.38003],[4.65481,52.38039],[4.6552,52.38059]]]}},{"n":"Vijfhoek, buurtaanpak","t":"vervanging","s":"2036","e":"2037","g":{"type":"Polygon","coordinates":[[[4.62987,52.38216],[4.62954,52.38223],[4.62892,52.38238],[4.62769,52.3811],[4.62756,52.38096],[4.62738,52.38077],[4.627,52.38037],[4.62664,52.38],[4.6263,52.37963],[4.62593,52.37925],[4.62562,52.37893],[4.62542,52.37871],[4.6252,52.37848],[4.6249,52.37816],[4.62459,52.37782],[4.6244,52.37761],[4.62659,52.37741],[4.627,52.37706],[4.62814,52.37656],[4.62958,52.37617],[4.631,52.37604],[4.63123,52.37653],[4.63159,52.37721],[4.63192,52.3778],[4.63214,52.37811],[4.63239,52.37832],[4.63269,52.3786],[4.63317,52.37901],[4.63338,52.37926],[4.63347,52.3794],[4.63294,52.37974],[4.63288,52.37978],[4.63276,52.38005],[4.63262,52.38028],[4.63253,52.38056],[4.63227,52.38105],[4.63215,52.38132],[4.63198,52.38169],[4.63193,52.38187],[4.63144,52.38194],[4.63049,52.38208],[4.62987,52.38216]]]}},{"n":"De Burgen, buurtaanpak","t":"reconstructie","s":"2033","e":"2034","g":{"type":"Polygon","coordinates":[[[4.65478,52.35158],[4.65472,52.35181],[4.65473,52.35292],[4.65244,52.35286],[4.652,52.35286],[4.65152,52.35275],[4.65065,52.35256],[4.64958,52.35254],[4.64868,52.35251],[4.64871,52.35214],[4.64898,52.35162],[4.6492,52.35134],[4.64965,52.3507],[4.65031,52.34976],[4.65067,52.34925],[4.65089,52.34903],[4.65136,52.34865],[4.65165,52.34866],[4.65237,52.34876],[4.65388,52.3491],[4.65442,52.34923],[4.6548,52.34937],[4.65552,52.34969],[4.65566,52.34978],[4.65569,52.3498],[4.65533,52.35076],[4.65478,52.35158]]]}},{"n":"Hondsbos-Dever, buurtaanpak","t":"reconstructie","s":"2033","e":"2034","g":{"type":"Polygon","coordinates":[[[4.64452,52.35424],[4.64448,52.35448],[4.6444,52.35494],[4.64327,52.35493],[4.64223,52.35488],[4.64235,52.35396],[4.64245,52.35344],[4.6425,52.35299],[4.64261,52.35243],[4.64266,52.35214],[4.6427,52.35191],[4.64181,52.35188],[4.64149,52.3518],[4.64135,52.3517],[4.64148,52.35156],[4.6416,52.35129],[4.6417,52.35065],[4.64173,52.35033],[4.64359,52.35035],[4.64472,52.35034],[4.64601,52.35032],[4.64643,52.34984],[4.64703,52.3492],[4.64745,52.34878],[4.64769,52.34856],[4.64805,52.34821],[4.64824,52.34802],[4.64832,52.34769],[4.64833,52.34765],[4.64872,52.34776],[4.65044,52.34821],[4.651,52.34845],[4.65136,52.34865],[4.65089,52.34903],[4.65067,52.34925],[4.65031,52.34976],[4.64965,52.3507],[4.6492,52.35134],[4.64898,52.35162],[4.64871,52.35214],[4.64868,52.35251],[4.64865,52.35294],[4.64859,52.35359],[4.64697,52.35353],[4.64508,52.35346],[4.64465,52.35344],[4.64461,52.35386],[4.64452,52.35424]]]}},{"n":"Professorenbuurt, buurtaanpak","t":"vervanging","s":"2031","e":"2032","g":{"type":"Polygon","coordinates":[[[4.6664,52.36665],[4.66611,52.36782],[4.66403,52.3678],[4.66404,52.36775],[4.6641,52.36744],[4.66415,52.36725],[4.66426,52.36671],[4.66437,52.36614],[4.66441,52.36577],[4.6644,52.36549],[4.66442,52.36492],[4.66451,52.36452],[4.66454,52.36434],[4.66474,52.36351],[4.66481,52.36314],[4.66499,52.36223],[4.66515,52.36152],[4.66517,52.36108],[4.66517,52.3607],[4.66515,52.36059],[4.66529,52.36059],[4.66552,52.36059],[4.66581,52.36059],[4.66616,52.3606],[4.66628,52.3606],[4.66662,52.3606],[4.66682,52.3606],[4.66724,52.36059],[4.66744,52.36058],[4.66783,52.36058],[4.66772,52.36106],[4.6673,52.36282],[4.66703,52.364],[4.66669,52.36538],[4.6664,52.36665]]]}},{"n":"Saeftinge Nemelaar, buurtaanpak","t":"reconstructie","s":"2031","e":"2032","g":{"type":"Polygon","coordinates":[[[4.65697,52.34838],[4.65637,52.34923],[4.65566,52.34978],[4.65552,52.34969],[4.6548,52.34937],[4.65442,52.34923],[4.65388,52.3491],[4.65237,52.34876],[4.65165,52.34866],[4.65136,52.34865],[4.651,52.34845],[4.65044,52.34821],[4.64872,52.34776],[4.64833,52.34765],[4.64841,52.34739],[4.64845,52.34726],[4.64864,52.34663],[4.64874,52.34629],[4.64889,52.34577],[4.64914,52.34575],[4.64995,52.34571],[4.65054,52.34569],[4.6506,52.34568],[4.65067,52.34575],[4.65099,52.34574],[4.65111,52.34579],[4.65123,52.3459],[4.65154,52.34598],[4.65195,52.34601],[4.65216,52.34608],[4.65276,52.34635],[4.65303,52.34637],[4.65362,52.34661],[4.65351,52.34685],[4.65463,52.34718],[4.65514,52.34731],[4.6551,52.34736],[4.65526,52.3474],[4.65549,52.34748],[4.65609,52.34772],[4.65631,52.34782],[4.65698,52.34811],[4.65712,52.34816],[4.65697,52.34838]]]}},{"n":"Generaalsbuurt, buurtaanpak","t":"vervanging","s":"2032","e":"2033","g":{"type":"Polygon","coordinates":[[[4.64253,52.39619],[4.64207,52.39625],[4.64163,52.39631],[4.64162,52.39628],[4.64153,52.39609],[4.64142,52.39574],[4.64137,52.3956],[4.64137,52.39559],[4.64116,52.39502],[4.64106,52.39476],[4.64105,52.39474],[4.64094,52.39444],[4.64085,52.39424],[4.64081,52.3942],[4.64072,52.39408],[4.64055,52.3938],[4.64046,52.39363],[4.64032,52.39338],[4.64017,52.39311],[4.64019,52.39305],[4.64144,52.3928],[4.64285,52.39251],[4.64392,52.39237],[4.64417,52.39298],[4.64439,52.39344],[4.64498,52.39472],[4.64502,52.39482],[4.64544,52.39509],[4.64629,52.3956],[4.64632,52.39564],[4.64589,52.3957],[4.64557,52.39575],[4.64491,52.39585],[4.64463,52.39589],[4.64457,52.3959],[4.64385,52.39599],[4.64358,52.39603],[4.64253,52.39619]]]}},{"n":"Nelson Mandelabuurt, buurtaanpak","t":"vervanging","s":"2033","e":"2034","g":{"type":"Polygon","coordinates":[[[4.64285,52.39251],[4.64144,52.3928],[4.64019,52.39305],[4.64028,52.39275],[4.64037,52.3925],[4.64053,52.39214],[4.64055,52.39202],[4.64058,52.39174],[4.64064,52.39126],[4.64065,52.39092],[4.64115,52.39092],[4.64181,52.39077],[4.64291,52.39055],[4.64304,52.39083],[4.64397,52.39066],[4.64451,52.39056],[4.6447,52.39053],[4.64494,52.39051],[4.64505,52.39048],[4.64513,52.39063],[4.64556,52.39057],[4.64631,52.39049],[4.64793,52.39033],[4.64853,52.39028],[4.64904,52.3902],[4.64975,52.39015],[4.65004,52.39014],[4.65042,52.39141],[4.64984,52.39149],[4.64885,52.39162],[4.64646,52.39198],[4.64435,52.39232],[4.64392,52.39237],[4.64285,52.39251]]]}},{"n":"Burgwal restant, buurtaanpak","t":"vervanging","s":"2030","e":"2031","g":{"type":"Polygon","coordinates":[[[4.64373,52.38368],[4.64282,52.38399],[4.64231,52.38403],[4.64213,52.38382],[4.64205,52.38339],[4.64258,52.38305],[4.64427,52.3823],[4.64488,52.38193],[4.64493,52.38159],[4.64481,52.38122],[4.64404,52.38079],[4.64253,52.38034],[4.64086,52.38008],[4.63996,52.37995],[4.63942,52.37983],[4.63887,52.3797],[4.63842,52.37952],[4.63802,52.37914],[4.63799,52.37877],[4.6382,52.3782],[4.63849,52.37795],[4.63907,52.37745],[4.63971,52.37707],[4.63998,52.37691],[4.64022,52.37676],[4.64052,52.37665],[4.6409,52.37651],[4.64133,52.37635],[4.64139,52.37632],[4.64139,52.37632],[4.64508,52.37934],[4.64515,52.3794],[4.64522,52.37946],[4.64575,52.37986],[4.6459,52.37999],[4.64604,52.38011],[4.64618,52.3802],[4.64644,52.38028],[4.64659,52.38035],[4.64675,52.38045],[4.64677,52.38046],[4.64684,52.38055],[4.64692,52.38065],[4.64697,52.38072],[4.64704,52.3808],[4.64706,52.38086],[4.64707,52.3809],[4.64708,52.38105],[4.64707,52.38114],[4.64707,52.38121],[4.64706,52.3813],[4.64706,52.38136],[4.64706,52.38145],[4.64707,52.3815],[4.64708,52.38158],[4.64709,52.38168],[4.64711,52.38177],[4.64712,52.38179],[4.64713,52.38184],[4.64716,52.38191],[4.64716,52.38193],[4.6472,52.38202],[4.64723,52.3821],[4.64725,52.38215],[4.64728,52.38222],[4.64729,52.38224],[4.64731,52.38228],[4.64736,52.38236],[4.64694,52.3825],[4.64648,52.38264],[4.64608,52.38279],[4.64578,52.38288],[4.64438,52.38337],[4.64413,52.38345],[4.64399,52.38348],[4.64383,52.38348],[4.64373,52.38368]]]}},{"n":"Sinnevelt, buurtaanpak","t":"vervanging","s":"2034","e":"2035","g":{"type":"Polygon","coordinates":[[[4.63999,52.41099],[4.6383,52.41169],[4.63729,52.41212],[4.63717,52.41198],[4.6369,52.41167],[4.63683,52.4116],[4.63676,52.41153],[4.63628,52.41098],[4.63627,52.41097],[4.63626,52.41095],[4.63618,52.41082],[4.63613,52.41083],[4.63518,52.40863],[4.63419,52.40671],[4.63419,52.40669],[4.63508,52.4065],[4.63664,52.40622],[4.63695,52.40617],[4.63775,52.40593],[4.63846,52.40569],[4.63915,52.40526],[4.63931,52.40536],[4.64016,52.40588],[4.64057,52.40614],[4.64183,52.40655],[4.64396,52.40725],[4.64451,52.40743],[4.64421,52.40775],[4.64378,52.4082],[4.64292,52.40883],[4.64224,52.40937],[4.64152,52.40999],[4.64078,52.41064],[4.63999,52.41099]]]}},{"n":"Van Schendelbuurt, buurtaanpak","t":"reconstructie","s":"2034","e":"2035","g":{"type":"Polygon","coordinates":[[[4.64374,52.41721],[4.64386,52.41747],[4.64249,52.41787],[4.64241,52.41777],[4.64206,52.41738],[4.64189,52.41718],[4.64108,52.41625],[4.64026,52.41528],[4.63987,52.41499],[4.63958,52.41471],[4.63938,52.41451],[4.64147,52.41403],[4.64225,52.41386],[4.64253,52.4138],[4.64406,52.41348],[4.64481,52.41333],[4.64527,52.41381],[4.6463,52.41473],[4.6469,52.41527],[4.64747,52.41579],[4.64664,52.41609],[4.64372,52.41714],[4.64374,52.41721]]]}},{"n":"Cremerbuurt, buurtaanpak","t":"reconstructie","s":"2034","e":"2035","g":{"type":"Polygon","coordinates":[[[4.661,52.38147],[4.66099,52.38164],[4.66099,52.38175],[4.66089,52.38175],[4.65873,52.38161],[4.65759,52.38154],[4.65755,52.38154],[4.65614,52.38146],[4.65624,52.3807],[4.6552,52.38059],[4.65481,52.38039],[4.65468,52.38003],[4.65467,52.37997],[4.65587,52.37964],[4.6567,52.37934],[4.65713,52.37925],[4.65875,52.37909],[4.6598,52.37899],[4.65982,52.37899],[4.66004,52.37897],[4.66034,52.37893],[4.66043,52.37891],[4.66049,52.37902],[4.66055,52.37922],[4.6607,52.37991],[4.66078,52.3803],[4.66086,52.38069],[4.66089,52.38086],[4.66092,52.38101],[4.66093,52.38104],[4.661,52.38147]]]}},{"n":"Koninginnebuurt restant, buurtaanpak","t":"vervanging","s":"2032","e":"2033","g":{"type":"Polygon","coordinates":[[[4.627,52.37706],[4.62659,52.37741],[4.6244,52.37761],[4.62389,52.37706],[4.62181,52.37478],[4.62125,52.37417],[4.61928,52.37201],[4.61901,52.37172],[4.61857,52.37124],[4.61886,52.3712],[4.61952,52.37114],[4.62006,52.37108],[4.6218,52.37089],[4.62187,52.37088],[4.6224,52.37012],[4.62254,52.37007],[4.62269,52.37001],[4.6232,52.37059],[4.62388,52.37119],[4.62453,52.37176],[4.62581,52.3726],[4.6272,52.37322],[4.62937,52.37396],[4.62978,52.3742],[4.63003,52.37456],[4.6303,52.37453],[4.63098,52.37601],[4.631,52.37604],[4.62958,52.37617],[4.62814,52.37656],[4.627,52.37706]]]}},{"n":"Ellertsveld, buurtaanpak","t":"vervanging","s":"2035","e":"2036","g":{"type":"Polygon","coordinates":[[[4.65724,52.3561],[4.65726,52.35653],[4.65412,52.35651],[4.6532,52.35644],[4.65322,52.35636],[4.65325,52.3561],[4.65319,52.35584],[4.65303,52.3556],[4.65288,52.35553],[4.65325,52.35532],[4.65394,52.35494],[4.65424,52.35468],[4.65468,52.35424],[4.65471,52.35329],[4.65473,52.35292],[4.65472,52.35181],[4.65478,52.35158],[4.65533,52.35076],[4.65569,52.3498],[4.65566,52.34978],[4.65637,52.34923],[4.65697,52.34838],[4.65712,52.34816],[4.65719,52.34806],[4.65728,52.34788],[4.65772,52.348],[4.65792,52.34806],[4.65799,52.34809],[4.65804,52.34827],[4.65817,52.34835],[4.65835,52.34843],[4.65873,52.34861],[4.65877,52.34863],[4.65925,52.34886],[4.65947,52.34897],[4.66035,52.34937],[4.66056,52.34947],[4.66064,52.34957],[4.66073,52.34985],[4.66079,52.34998],[4.66089,52.35007],[4.66095,52.35009],[4.66061,52.35021],[4.66049,52.35024],[4.66012,52.35042],[4.66001,52.35056],[4.65999,52.35058],[4.65969,52.35097],[4.65953,52.35119],[4.65941,52.35136],[4.65935,52.35144],[4.65918,52.35155],[4.65912,52.3516],[4.65884,52.35198],[4.65871,52.35217],[4.65868,52.35233],[4.65868,52.35248],[4.6585,52.35277],[4.65828,52.35316],[4.65821,52.35324],[4.65813,52.35329],[4.65803,52.35339],[4.65786,52.35368],[4.65786,52.35368],[4.65786,52.35368],[4.65786,52.35368],[4.65778,52.3538],[4.65766,52.354],[4.65763,52.35401],[4.65718,52.35412],[4.65716,52.35415],[4.65717,52.35419],[4.65727,52.35427],[4.65727,52.35431],[4.65728,52.35452],[4.65728,52.35475],[4.65728,52.35541],[4.65724,52.3561]]]}},{"n":"De Goede Hoop, buurtaanpak","t":"vervanging","s":"2032","e":"2033","g":{"type":"Polygon","coordinates":[[[4.64737,52.39548],[4.64648,52.39562],[4.64632,52.39564],[4.64629,52.3956],[4.64544,52.39509],[4.64502,52.39482],[4.64498,52.39472],[4.64439,52.39344],[4.64417,52.39298],[4.64392,52.39237],[4.64435,52.39232],[4.64646,52.39198],[4.64885,52.39162],[4.64984,52.39149],[4.65042,52.39141],[4.65097,52.39332],[4.65148,52.39504],[4.65153,52.39522],[4.6498,52.3954],[4.64838,52.39558],[4.64837,52.39557],[4.64827,52.39535],[4.64776,52.39542],[4.64754,52.39546],[4.64737,52.39548]]]}},{"n":"Landenbuurt, buurtaanpak","t":"reconstructie","s":"2031","e":"2032","g":{"type":"Polygon","coordinates":[[[4.64393,52.36463],[4.64329,52.36467],[4.64324,52.36467],[4.64296,52.36464],[4.64237,52.36459],[4.64239,52.36448],[4.6424,52.36399],[4.64232,52.36341],[4.64226,52.36287],[4.64219,52.36222],[4.64214,52.36176],[4.64212,52.36159],[4.64206,52.36114],[4.64214,52.36075],[4.64263,52.36099],[4.64266,52.36116],[4.64351,52.36121],[4.6459,52.36136],[4.6473,52.36145],[4.64803,52.36149],[4.64989,52.36159],[4.65034,52.36162],[4.65098,52.36167],[4.65155,52.36175],[4.65135,52.36228],[4.65119,52.36253],[4.65092,52.36311],[4.65072,52.36358],[4.65054,52.364],[4.65044,52.36428],[4.65035,52.36456],[4.6502,52.36455],[4.6491,52.36449],[4.6485,52.36445],[4.64809,52.36443],[4.64607,52.36453],[4.64393,52.36463]]]}}];
var _PEILBUIZEN=[{"lo":4.64449,"la":52.38014,"mv":0.54,"ws":-0.544,"n":"07-219","d":"2024-11-19"},{"lo":4.64712,"la":52.37416,"mv":0.42,"ws":-0.795,"n":"07-225","d":"2024-07-05"},{"lo":4.63521,"la":52.37844,"mv":1.58,"ws":-0.479,"n":"08-113","d":"2024-11-19"},{"lo":4.6367,"la":52.37702,"mv":1.27,"ws":-0.051,"n":"08-120","d":"2024-11-19"},{"lo":4.63634,"la":52.37861,"mv":1.91,"ws":-0.056,"n":"08-121","d":"2024-09-19"},{"lo":4.63942,"la":52.38271,"mv":1.16,"ws":-0.478,"n":"08-124","d":"2024-11-19"},{"lo":4.6282,"la":52.37754,"mv":0.9,"ws":-0.667,"n":"08-129","d":"2024-09-19"},{"lo":4.63804,"la":52.38594,"mv":0.8,"ws":-0.632,"n":"08-133","d":"2024-11-19"},{"lo":4.63574,"la":52.38722,"mv":1.16,"ws":-0.762,"n":"08-134","d":"2021-04-19"},{"lo":4.6396,"la":52.38382,"mv":1.83,"ws":-0.076,"n":"08-216","d":"2024-11-19"},{"lo":4.63579,"la":52.38722,"mv":1.16,"ws":-0.733,"n":"08-222","d":"2021-11-10"},{"lo":4.63827,"la":52.38589,"mv":0.92,"ws":-0.564,"n":"08-224","d":"2024-11-19"},{"lo":4.62972,"la":52.38112,"mv":0.63,"ws":-0.483,"n":"08-227","d":"2024-11-19"},{"lo":4.63672,"la":52.37693,"mv":1.33,"ws":-0.464,"n":"08-234","d":"2024-11-19"},{"lo":4.62761,"la":52.37996,"mv":0.6,"ws":-0.634,"n":"08-235","d":"2024-11-19"},{"lo":4.63942,"la":52.38271,"mv":1.16,"ws":-0.351,"n":"08-236","d":"2024-11-19"},{"lo":4.63046,"la":52.38312,"mv":0.62,"ws":-0.457,"n":"08-237","d":"2024-11-19"},{"lo":4.64855,"la":52.42153,"mv":1.06,"ws":-0.005,"n":"02-102","d":"2011-08-30"},{"lo":4.64496,"la":52.41748,"mv":0.5,"ws":-0.468,"n":"02-113","d":"2007-10-15"},{"lo":4.6499,"la":52.41472,"mv":0.65,"ws":-0.492,"n":"02-119","d":"2024-11-19"},{"lo":4.65499,"la":52.40873,"mv":0.52,"ws":-0.54,"n":"02-124","d":"2024-09-19"},{"lo":4.6448,"la":52.41756,"mv":0.51,"ws":-0.545,"n":"02-201","d":"2011-06-06"},{"lo":4.64958,"la":52.40153,"mv":0.43,"ws":-0.848,"n":"03-113","d":"2024-11-19"},{"lo":4.64912,"la":52.39715,"mv":0.23,"ws":-0.457,"n":"03-122","d":"2024-11-19"},{"lo":4.63626,"la":52.40092,"mv":0.31,"ws":-0.689,"n":"03-126","d":"2024-11-06"},{"lo":4.62925,"la":52.40655,"mv":0.4,"ws":-0.574,"n":"03-132","d":"2024-11-19"},{"lo":4.63672,"la":52.40191,"mv":0.37,"ws":-0.858,"n":"03-136","d":"2024-11-19"},{"lo":4.6446,"la":52.40052,"mv":0.37,"ws":-0.703,"n":"03-140","d":"2024-11-19"},{"lo":4.63251,"la":52.40358,"mv":0.41,"ws":-0.581,"n":"03-214","d":"2014-12-30"},{"lo":4.62914,"la":52.40655,"mv":0.47,"ws":-0.468,"n":"03-220","d":"2022-01-17"},{"lo":4.6446,"la":52.40052,"mv":0.37,"ws":-0.664,"n":"03-225","d":"2024-11-19"},{"lo":4.64446,"la":52.40492,"mv":0.45,"ws":-1.784,"n":"03-230","d":"2024-11-06"},{"lo":4.65135,"la":52.3857,"mv":0.27,"ws":-0.826,"n":"04-103","d":"2024-11-19"},{"lo":4.66396,"la":52.38312,"mv":0.43,"ws":-1.038,"n":"04-107","d":"2020-08-20"},{"lo":4.66491,"la":52.38825,"mv":0.39,"ws":-1.024,"n":"04-109","d":"2024-11-19"},{"lo":4.65319,"la":52.39227,"mv":0.48,"ws":-0.847,"n":"04-110","d":"2024-02-07"},{"lo":4.65339,"la":52.39228,"mv":0.46,"ws":-0.956,"n":"04-204","d":"2017-10-30"},{"lo":4.66708,"la":52.39264,"mv":0.32,"ws":-1.441,"n":"04-206","d":"2024-11-19"},{"lo":4.66486,"la":52.38823,"mv":0.44,"ws":-0.961,"n":"04-207","d":"2024-11-19"},{"lo":4.63737,"la":52.39741,"mv":0.47,"ws":-0.66,"n":"05-102","d":"2024-11-19"},{"lo":4.6478,"la":52.39416,"mv":0.26,"ws":-0.507,"n":"05-104","d":"2024-11-19"},{"lo":4.62997,"la":52.39239,"mv":0.42,"ws":-0.517,"n":"05-114","d":"2024-11-19"},{"lo":4.64649,"la":52.3961,"mv":0.45,"ws":-0.3,"n":"05-124","d":"2023-11-30"},{"lo":4.64561,"la":52.39441,"mv":0.5,"ws":-0.707,"n":"05-126","d":"2020-07-01"},{"lo":4.64382,"la":52.39244,"mv":0.51,"ws":-0.487,"n":"05-128","d":"2024-11-19"},{"lo":4.62634,"la":52.393,"mv":0.28,"ws":-0.547,"n":"05-145","d":"2024-10-11"},{"lo":4.64769,"la":52.38909,"mv":0.31,"ws":-0.637,"n":"05-220","d":"2024-10-29"},{"lo":4.6689,"la":52.37624,"mv":-0.68,"ws":-2.117,"n":"06-110","d":"2024-11-19"},{"lo":4.66465,"la":52.3787,"mv":0.62,"ws":-1.651,"n":"06-201","d":"2013-06-24"},{"lo":4.65338,"la":52.38053,"mv":0.05,"ws":-1.093,"n":"07-102","d":"2024-11-19"},{"lo":4.64754,"la":52.37048,"mv":0.44,"ws":-0.627,"n":"07-110","d":"2020-04-20"},{"lo":4.64291,"la":52.37076,"mv":0.67,"ws":-0.751,"n":"07-116","d":"2021-05-18"},{"lo":4.64948,"la":52.37542,"mv":0.37,"ws":-0.632,"n":"07-125","d":"2024-11-19"},{"lo":4.64668,"la":52.38237,"mv":0.56,"ws":-0.408,"n":"07-130","d":"2024-11-19"},{"lo":4.64758,"la":52.37745,"mv":0.17,"ws":-0.902,"n":"07-136","d":"2024-11-19"},{"lo":4.6415,"la":52.37847,"mv":0.44,"ws":-0.654,"n":"07-150","d":"2024-10-11"},{"lo":4.65746,"la":52.37599,"mv":0.48,"ws":-0.79,"n":"07-159","d":"2024-11-19"},{"lo":4.65937,"la":52.37897,"mv":0.26,"ws":-0.743,"n":"07-162","d":"2024-11-19"},{"lo":4.65601,"la":52.37414,"mv":0.5,"ws":-0.71,"n":"07-170","d":"2024-11-19"},{"lo":4.65447,"la":52.37454,"mv":0.54,"ws":0.79,"n":"07-173","d":"2024-11-19"},{"lo":4.64705,"la":52.38444,"mv":0.24,"ws":-0.801,"n":"07-207","d":"2022-05-23"},{"lo":4.61914,"la":52.37883,"mv":0.23,"ws":-0.904,"n":"09-104","d":"2024-11-19"},{"lo":4.62493,"la":52.38622,"mv":0.43,"ws":-0.452,"n":"09-112","d":"2024-11-19"},{"lo":4.61717,"la":52.38212,"mv":0.51,"ws":-0.344,"n":"09-113","d":"2024-11-19"},{"lo":4.62235,"la":52.38015,"mv":0.13,"ws":-0.726,"n":"09-116","d":"2024-11-19"},{"lo":4.6217,"la":52.38452,"mv":0.39,"ws":-0.593,"n":"09-119","d":"2024-11-19"},{"lo":4.62564,"la":52.38107,"mv":0.26,"ws":-0.108,"n":"09-127","d":"2024-11-19"},{"lo":4.61826,"la":52.38037,"mv":0.17,"ws":-0.105,"n":"09-131","d":"2017-11-29"},{"lo":4.62375,"la":52.37917,"mv":0.27,"ws":-0.593,"n":"09-136","d":"2015-01-30"},{"lo":4.62103,"la":52.38042,"mv":0.06,"ws":-0.917,"n":"09-205","d":"2024-11-19"},{"lo":4.62208,"la":52.37907,"mv":0.24,"ws":-0.681,"n":"09-207","d":"2024-03-26"},{"lo":4.62162,"la":52.38446,"mv":0.37,"ws":-0.58,"n":"09-209","d":"2024-11-19"},{"lo":4.62875,"la":52.38644,"mv":0.49,"ws":-0.322,"n":"09-222","d":"2016-11-02"},{"lo":4.60986,"la":52.3833,"mv":0.53,"ws":-0.82,"n":"10-105","d":"2021-09-17"},{"lo":4.60208,"la":52.37213,"mv":3.31,"ws":0.246,"n":"10-107","d":"2016-11-02"},{"lo":4.61333,"la":52.38797,"mv":0.58,"ws":-0.4,"n":"10-203","d":"2024-11-19"},{"lo":4.60974,"la":52.38337,"mv":0.54,"ws":-0.587,"n":"10-205","d":"2021-07-19"},{"lo":4.60207,"la":52.37204,"mv":3.3,"ws":2.425,"n":"10-208","d":"2024-07-19"},{"lo":4.62157,"la":52.37702,"mv":0.49,"ws":-0.563,"n":"11-106","d":"2024-11-19"},{"lo":4.61338,"la":52.36861,"mv":0.49,"ws":-0.923,"n":"11-108","d":"2024-11-19"},{"lo":4.60893,"la":52.36736,"mv":0.34,"ws":-0.659,"n":"11-111","d":"2024-11-19"},{"lo":4.61131,"la":52.37035,"mv":0.08,"ws":-0.707,"n":"11-114","d":"2015-02-12"},{"lo":4.61352,"la":52.36754,"mv":0.33,"ws":-0.636,"n":"11-122","d":"2024-11-19"},{"lo":4.61676,"la":52.37091,"mv":0.39,"ws":-0.34,"n":"11-124","d":"2024-11-19"},{"lo":4.61826,"la":52.37553,"mv":0.36,"ws":-0.9,"n":"11-126","d":"2023-03-02"},{"lo":4.6116,"la":52.36569,"mv":0.52,"ws":-0.651,"n":"11-204","d":"2024-11-19"},{"lo":4.61689,"la":52.37088,"mv":0.31,"ws":-0.448,"n":"11-205","d":"2024-11-19"},{"lo":4.61199,"la":52.37028,"mv":0.2,"ws":-0.644,"n":"11-208","d":"2024-11-19"},{"lo":4.62764,"la":52.37504,"mv":1.04,"ws":-0.513,"n":"12-110","d":"2020-08-20"},{"lo":4.64059,"la":52.37258,"mv":0.39,"ws":-0.799,"n":"12-125","d":"2015-12-08"},{"lo":4.63498,"la":52.37422,"mv":0.99,"ws":-0.42,"n":"12-130","d":"2024-11-19"},{"lo":4.61771,"la":52.3694,"mv":0.41,"ws":-0.3,"n":"12-138","d":"2024-09-20"},{"lo":4.6186,"la":52.36856,"mv":0.75,"ws":-0.102,"n":"12-139","d":"2024-11-19"},{"lo":4.61894,"la":52.36992,"mv":0.55,"ws":-0.353,"n":"12-140","d":"2024-11-19"},{"lo":4.61726,"la":52.36766,"mv":0.41,"ws":-0.717,"n":"12-145","d":"2024-11-19"},{"lo":4.62239,"la":52.37417,"mv":0.62,"ws":-0.477,"n":"12-153","d":"2020-07-06"},{"lo":4.63395,"la":52.37131,"mv":0.94,"ws":-0.365,"n":"12-164","d":"2024-11-19"},{"lo":4.62844,"la":52.36903,"mv":1.48,"ws":-0.318,"n":"12-201","d":"2021-12-05"},{"lo":4.6199,"la":52.36749,"mv":0.92,"ws":-0.459,"n":"12-225","d":"2024-10-31"},{"lo":4.62225,"la":52.37419,"mv":0.61,"ws":-0.422,"n":"12-231","d":"2020-08-10"},{"lo":4.635,"la":52.37207,"mv":0.84,"ws":-0.446,"n":"12-236","d":"2024-11-19"},{"lo":4.64731,"la":52.36362,"mv":0.39,"ws":-0.918,"n":"13-105","d":"2024-11-19"},{"lo":4.6458,"la":52.35962,"mv":0.5,"ws":-0.834,"n":"13-117","d":"2024-05-02"},{"lo":4.64372,"la":52.35799,"mv":0.51,"ws":-1.216,"n":"13-119","d":"2018-11-05"},{"lo":4.64803,"la":52.35828,"mv":0.51,"ws":-0.419,"n":"13-120","d":"2011-09-05"},{"lo":4.6509,"la":52.357,"mv":0.41,"ws":-0.654,"n":"13-127","d":"2011-11-15"},{"lo":4.65243,"la":52.3584,"mv":0.66,"ws":-0.769,"n":"13-212","d":"2024-11-19"},{"lo":4.66434,"la":52.36682,"mv":0.72,"ws":-0.927,"n":"14-102","d":"2023-03-16"},{"lo":4.66088,"la":52.36366,"mv":0.54,"ws":-1.003,"n":"14-112","d":"2024-11-19"},{"lo":4.66087,"la":52.36258,"mv":0.38,"ws":-0.192,"n":"14-116","d":"2015-02-25"},{"lo":4.65563,"la":52.36099,"mv":0.59,"ws":-0.478,"n":"14-120","d":"2013-06-25"},{"lo":4.66596,"la":52.3613,"mv":0.3,"ws":-0.682,"n":"14-126","d":"2018-11-19"},{"lo":4.66112,"la":52.3541,"mv":0.4,"ws":-1.412,"n":"15-109","d":"2013-07-26"},{"lo":4.66587,"la":52.3565,"mv":0.38,"ws":-1.49,"n":"15-110","d":"2024-11-19"},{"lo":4.66102,"la":52.35903,"mv":0.56,"ws":-0.866,"n":"15-119","d":"2024-11-19"},{"lo":4.66095,"la":52.35128,"mv":0.35,"ws":-2.146,"n":"15-211","d":"2024-11-19"},{"lo":4.64954,"la":52.35011,"mv":0.49,"ws":-1.277,"n":"16-105","d":"2024-11-19"},{"lo":4.6561,"la":52.35081,"mv":0.6,"ws":-0.924,"n":"16-106","d":"2024-11-06"},{"lo":4.6535,"la":52.34737,"mv":0.53,"ws":-0.922,"n":"16-107","d":"2024-11-19"},{"lo":4.65352,"la":52.35285,"mv":0.56,"ws":-1.349,"n":"16-201","d":"2024-11-19"},{"lo":4.6496,"la":52.35004,"mv":0.51,"ws":-1.068,"n":"16-205","d":"2024-10-11"},{"lo":4.65596,"la":52.35077,"mv":0.61,"ws":-0.93,"n":"16-206","d":"2024-11-19"},{"lo":4.66291,"la":52.35306,"mv":0.44,"ws":-1.358,"n":"15-111","d":"2024-10-11"},{"lo":4.6523,"la":52.35835,"mv":0.63,"ws":-0.808,"n":"13-128","d":"2024-11-06"},{"lo":4.53826,"la":52.37759,"mv":2.06,"ws":0.542,"n":"ZP 5F 04","d":"2025-03-20"},{"lo":4.53716,"la":52.36678,"mv":6.77,"ws":5.063,"n":"ZP 4F 04","d":"2025-03-20"},{"lo":4.54182,"la":52.37384,"mv":3.68,"ws":2.177,"n":"ZP 3F 01","d":"2025-03-20"},{"lo":4.5343,"la":52.37632,"mv":3.4,"ws":2.249,"n":"ZP 5D 02 diep","d":"2025-03-20"},{"lo":4.55285,"la":52.36611,"mv":1.69,"ws":0.083,"n":"ZP 8F 04","d":"2025-03-20"},{"lo":4.55081,"la":52.36615,"mv":1.63,"ws":0.213,"n":"ZP 8F 03","d":"2025-03-20"},{"lo":4.53428,"la":52.37633,"mv":3.4,"ws":2.258,"n":"ZP 5D 02 ondiep","d":"2025-03-20"},{"lo":4.5368,"la":52.37606,"mv":3.76,"ws":2.31,"n":"ZP 5F 07","d":"2025-03-05"},{"lo":4.54023,"la":52.37643,"mv":3.84,"ws":2.472,"n":"ZP 5F 06","d":"2025-03-05"},{"lo":4.64579,"la":52.39336,"mv":0.63,"ws":-0.72,"n":"05-127","d":"2024-11-19"},{"lo":4.64557,"la":52.39739,"mv":0.48,"ws":-0.587,"n":"05-219","d":"2024-11-19"},{"lo":4.6644,"la":52.37882,"mv":0.62,"ws":-0.74,"n":"06-104","d":"2013-06-10"},{"lo":4.62493,"la":52.37857,"mv":0.24,"ws":-0.838,"n":"09-125","d":"2024-11-19"},{"lo":4.61589,"la":52.37928,"mv":0.18,"ws":-0.796,"n":"11-207","d":"2024-11-19"},{"lo":4.63466,"la":52.36304,"mv":0.18,"ws":-0.632,"n":"12-205","d":"2024-11-19"},{"lo":4.61826,"la":52.37553,"mv":0.37,"ws":-0.22,"n":"11-203","d":"2023-03-02"},{"lo":4.61197,"la":52.36811,"mv":0.43,"ws":-0.832,"n":"11-123","d":"2024-11-19"},{"lo":4.61336,"la":52.38799,"mv":0.61,"ws":-0.578,"n":"10-110","d":"2024-11-19"},{"lo":4.60485,"la":52.38541,"mv":0.92,"ws":-0.64,"n":"10-101","d":"2024-09-19"},{"lo":4.6225,"la":52.38012,"mv":0.13,"ws":-0.858,"n":"09-206","d":"2024-09-20"},{"lo":4.62281,"la":52.37834,"mv":0.13,"ws":-0.934,"n":"09-105","d":"2024-02-06"},{"lo":4.64681,"la":52.38233,"mv":0.52,"ws":-0.869,"n":"07-204","d":"2024-11-19"},{"lo":4.64645,"la":52.37158,"mv":0.35,"ws":-0.941,"n":"07-169","d":"2024-11-19"},{"lo":4.64449,"la":52.38014,"mv":0.54,"ws":-0.496,"n":"07-154","d":"2024-09-19"},{"lo":4.65163,"la":52.37438,"mv":0.36,"ws":-0.77,"n":"07-120","d":"2024-11-19"},{"lo":4.66914,"la":52.38082,"mv":0.46,"ws":-0.861,"n":"06-112","d":"2024-11-06"},{"lo":4.62966,"la":52.39207,"mv":0.39,"ws":-0.553,"n":"05-223","d":"2024-11-19"},{"lo":4.64802,"la":52.39464,"mv":0.26,"ws":-0.708,"n":"05-207","d":"2024-11-19"},{"lo":4.63706,"la":52.39248,"mv":0.64,"ws":-0.499,"n":"05-131","d":"2024-11-19"},{"lo":4.65061,"la":52.39658,"mv":0.23,"ws":-1.105,"n":"05-107","d":"2024-11-19"},{"lo":4.66714,"la":52.39254,"mv":0.32,"ws":-1.415,"n":"04-112","d":"2024-11-06"},{"lo":4.65135,"la":52.39911,"mv":0.59,"ws":-0.735,"n":"03-121A","d":"2024-11-19"},{"lo":4.63872,"la":52.40868,"mv":0.67,"ws":-0.438,"n":"03-105","d":"2024-11-19"},{"lo":4.6276,"la":52.38002,"mv":0.54,"ws":-0.656,"n":"08-130","d":"2024-11-19"},{"lo":4.6411,"la":52.38106,"mv":0.49,"ws":-0.851,"n":"08-116","d":"2024-10-31"},{"lo":4.65952,"la":52.37896,"mv":0.25,"ws":-0.916,"n":"07-222","d":"2024-11-19"},{"lo":4.63629,"la":52.38114,"mv":1.75,"ws":-0.307,"n":"08-221","d":"2024-11-19"},{"lo":4.6552,"la":52.41825,"mv":0.65,"ws":-0.439,"n":"02-106","d":"2024-11-19"},{"lo":4.65141,"la":52.38561,"mv":0.27,"ws":-0.853,"n":"04-203","d":"2024-11-19"},{"lo":4.62811,"la":52.3989,"mv":0.39,"ws":-0.614,"n":"05-202","d":"2023-06-26"},{"lo":4.64778,"la":52.38074,"mv":0.44,"ws":-1.005,"n":"07-101","d":"2019-04-15"},{"lo":4.64579,"la":52.37816,"mv":0.31,"ws":-0.606,"n":"07-145","d":"2023-11-30"},{"lo":4.62233,"la":52.38233,"mv":0.3,"ws":-0.523,"n":"09-129","d":"2024-11-19"},{"lo":4.66564,"la":52.36242,"mv":0.31,"ws":-0.946,"n":"14-124","d":"2024-11-19"},{"lo":4.66206,"la":52.38022,"mv":0.57,"ws":-0.692,"n":"06-101","d":"2011-11-15"},{"lo":4.64484,"la":52.37551,"mv":0.46,"ws":-0.552,"n":"07-131","d":"2024-11-19"},{"lo":4.65901,"la":52.35618,"mv":0.47,"ws":-0.872,"n":"15-122","d":"2013-01-07"},{"lo":4.64958,"la":52.4082,"mv":0.39,"ws":-0.684,"n":"03-115","d":"2024-11-19"},{"lo":4.5342,"la":52.37476,"mv":3.83,"ws":2.679,"n":"ZP 5D 03-1 diep","d":"2025-03-20"},{"lo":4.63795,"la":52.39485,"mv":0.39,"ws":-0.799,"n":"05-130","d":"2011-08-30"},{"lo":4.64108,"la":52.37709,"mv":1.2,"ws":-0.199,"n":"07-217","d":"2024-11-19"},{"lo":4.65416,"la":52.37463,"mv":0.62,"ws":-0.712,"n":"07-226","d":"2024-11-19"},{"lo":4.63301,"la":52.38386,"mv":1.31,"ws":-0.502,"n":"08-112","d":"2024-11-19"},{"lo":4.64259,"la":52.38202,"mv":1.03,"ws":-0.17,"n":"08-119","d":"2024-11-19"},{"lo":4.6314,"la":52.38045,"mv":1.32,"ws":-0.153,"n":"08-128","d":"2023-03-16"},{"lo":4.64844,"la":52.41836,"mv":0.43,"ws":-0.561,"n":"02-101","d":"2024-11-19"},{"lo":4.64635,"la":52.41847,"mv":0.49,"ws":-0.618,"n":"02-112","d":"2014-05-09"},{"lo":4.65598,"la":52.40679,"mv":0.37,"ws":-0.507,"n":"02-121","d":"2024-03-13"},{"lo":4.65506,"la":52.40875,"mv":0.51,"ws":-0.49,"n":"02-203","d":"2024-09-19"},{"lo":4.64447,"la":52.40491,"mv":0.45,"ws":-0.49,"n":"03-117","d":"2024-11-19"},{"lo":4.65159,"la":52.40276,"mv":0.45,"ws":-0.67,"n":"03-146","d":"2024-11-19"},{"lo":4.62924,"la":52.40185,"mv":0.3,"ws":-0.713,"n":"03-217","d":"2024-11-19"},{"lo":4.65598,"la":52.38429,"mv":0.37,"ws":-0.8,"n":"04-106","d":"2024-11-19"},{"lo":4.63322,"la":52.40022,"mv":0.38,"ws":-0.886,"n":"05-101","d":"2024-10-31"},{"lo":4.64278,"la":52.3949,"mv":0.49,"ws":-0.445,"n":"05-129","d":"2024-11-19"},{"lo":4.63063,"la":52.39495,"mv":0.4,"ws":-0.395,"n":"05-222","d":"2012-03-07"},{"lo":4.67158,"la":52.37907,"mv":-0.58,"ws":-1.785,"n":"06-111","d":"2024-11-19"},{"lo":4.67143,"la":52.3791,"mv":-0.59,"ws":-2.028,"n":"06-205","d":"2024-11-19"},{"lo":4.65033,"la":52.37101,"mv":0.46,"ws":-0.535,"n":"07-113","d":"2010-04-20"},{"lo":4.65507,"la":52.37302,"mv":0.4,"ws":-0.875,"n":"07-132","d":"2024-11-19"},{"lo":4.64795,"la":52.37258,"mv":0.17,"ws":-1.037,"n":"07-168","d":"2024-10-11"},{"lo":4.65334,"la":52.3807,"mv":0.06,"ws":-1.028,"n":"07-201","d":"2024-11-19"},{"lo":4.62118,"la":52.38039,"mv":0.09,"ws":0.32,"n":"09-110","d":"2024-11-19"},{"lo":4.62678,"la":52.38556,"mv":0.51,"ws":-0.079,"n":"09-133","d":"2024-11-19"},{"lo":4.60141,"la":52.38265,"mv":0.61,"ws":-0.578,"n":"10-106","d":"2024-11-19"},{"lo":4.61165,"la":52.36578,"mv":0.51,"ws":-0.653,"n":"11-121","d":"2024-11-19"},{"lo":4.63719,"la":52.37332,"mv":0.45,"ws":-0.314,"n":"12-123","d":"2023-11-01"},{"lo":4.61997,"la":52.3703,"mv":0.69,"ws":-0.346,"n":"12-141","d":"2024-11-19"},{"lo":4.62851,"la":52.3691,"mv":1.51,"ws":0.285,"n":"12-150","d":"2022-05-05"},{"lo":4.63483,"la":52.37426,"mv":0.99,"ws":-0.371,"n":"12-220","d":"2024-11-19"},{"lo":4.6488,"la":52.36613,"mv":0.5,"ws":-0.806,"n":"13-102","d":"2018-11-19"},{"lo":4.65704,"la":52.36403,"mv":0.39,"ws":-0.894,"n":"14-127","d":"2024-11-19"},{"lo":4.66104,"la":52.36366,"mv":0.54,"ws":-0.974,"n":"14-210","d":"2024-11-06"},{"lo":4.6534,"la":52.3473,"mv":0.49,"ws":-2.293,"n":"16-207","d":"2024-11-19"},{"lo":4.64937,"la":52.36786,"mv":0.49,"ws":-1.14,"n":"14-207","d":"2024-11-19"},{"lo":4.55648,"la":52.38225,"mv":1.92,"ws":0.93,"n":"ZP 9F 01","d":"2025-03-20"},{"lo":4.53723,"la":52.3773,"mv":2.19,"ws":0.8,"n":"ZP 5F 01","d":"2025-03-20"},{"lo":4.53991,"la":52.37726,"mv":2.09,"ws":0.826,"n":"ZP 5F 05","d":"2025-03-20"},{"lo":4.61717,"la":52.37177,"mv":0.57,"ws":-0.981,"n":"11-101","d":"2019-04-16"},{"lo":4.61361,"la":52.37754,"mv":0.42,"ws":-0.75,"n":"11-112","d":"2024-11-19"},{"lo":4.62203,"la":52.37898,"mv":0.24,"ws":-0.594,"n":"09-117","d":"2024-11-19"},{"lo":4.65676,"la":52.37822,"mv":0.46,"ws":-0.96,"n":"07-105","d":"2024-04-23"},{"lo":4.53416,"la":52.37477,"mv":3.85,"ws":2.698,"n":"ZP 5D 03-3 ondiep","d":"2025-03-20"}];
function _gPip(pt,ring){var x=pt[0],y=pt[1],ins=false;for(var i=0,j=ring.length-1;i<ring.length;j=i++){var xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];if(((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ins=!ins;}return ins;}
function _gDist(lon,lat,ring){if(_gPip([lon,lat],ring))return 0;var mLat=111320,mLon=111320*Math.cos(lat*Math.PI/180),minD=Infinity;for(var i=0,j=ring.length-1;i<ring.length;j=i++){var px=(lon-ring[i][0])*mLon,py=(lat-ring[i][1])*mLat;var dx=(ring[j][0]-ring[i][0])*mLon,dy=(ring[j][1]-ring[i][1])*mLat;var lenSq=dx*dx+dy*dy,d;if(lenSq===0){d=Math.sqrt(px*px+py*py);}else{var t=Math.max(0,Math.min(1,(px*dx+py*dy)/lenSq));d=Math.sqrt((px-t*dx)*(px-t*dx)+(py-t*dy)*(py-t*dy));}if(d<minD)minD=d;}return minD;}
function _gNear(z,lon,lat,maxM){var t=z.g.type;if(t==='Polygon')return _gDist(lon,lat,z.g.coordinates[0])<=maxM;if(t==='MultiPolygon')return z.g.coordinates.some(function(p){return _gDist(lon,lat,p[0])<=maxM;});return false;}
var ExtreemModal = function(_ref_ex) {
  var onClose = _ref_ex.onClose;
  var E = React.createElement;
  var LABEL_ORDER = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
  var LABEL_COLORS = {'A++++':'#1a7340','A+++':'#1a7340','A++':'#217346','A+':'#2e8b57','A':'#3cb371','B':'#7ec850','C':'#d4e157','D':'#ffca28','E':'#ffa726','F':'#ef6c00','G':'#d32f2f'};
  var allData = typeof VVE_DATA !== 'undefined' ? VVE_DATA : [];

  var byVve = {};
  allData.forEach(function(item) {
    var id = item.vve_identificatie;
    if (!id) return;
    if (!byVve[id]) byVve[id] = { vve: item, addresses: [] };
    byVve[id].addresses.push(item);
  });
  var vves = Object.values(byVve);

  var vvesWithLabel = vves.map(function(g) {
    var label = getAverageEnergyLabel(g.addresses);
    return { vve: g.vve, addresses: g.addresses, label: label, labelIdx: LABEL_ORDER.indexOf(label) };
  }).filter(function(g) { return g.labelIdx >= 0; });
  vvesWithLabel.sort(function(a, b) { return a.labelIdx - b.labelIdx; });
  var besteLabel = vvesWithLabel[0];
  var slechtsteLabel = vvesWithLabel[vvesWithLabel.length - 1];

  var woningen = allData.filter(function(a) { return isWoonunit(a) && a.woz2025 > 0; });
  woningen.sort(function(a, b) { return b.woz2025 - a.woz2025; });
  var duurste = woningen[0];
  var goedkoopste = woningen[woningen.length - 1];

  var vvesMetGrootte = vves.filter(function(g) { return g.vve.aantal_woon_adr_in_vve > 0; });
  vvesMetGrootte.sort(function(a, b) { return b.vve.aantal_woon_adr_in_vve - a.vve.aantal_woon_adr_in_vve; });
  var grootsteVve = vvesMetGrootte[0];

  var grootsteMetSlecht = vvesWithLabel.slice().sort(function(a, b) {
    if (b.labelIdx !== a.labelIdx) return b.labelIdx - a.labelIdx;
    return (b.vve.aantal_woon_adr_in_vve || 0) - (a.vve.aantal_woon_adr_in_vve || 0);
  })[0];

  var metBouwjaar = allData.filter(function(a) { return parseInt(a.bouwjaar_gerelateerd_pand) > 1000; });
  metBouwjaar.sort(function(a, b) { return parseInt(a.bouwjaar_gerelateerd_pand) - parseInt(b.bouwjaar_gerelateerd_pand); });
  var oudstePand = metBouwjaar[0];
  var nieuwstePand = metBouwjaar[metBouwjaar.length - 1];

  var vvesMetWoz = vves.map(function(g) {
    var vals = g.addresses.filter(function(a) { return isWoonunit(a) && a.woz2025 > 0; }).map(function(a) { return a.woz2025; });
    var avgWoz = vals.length ? vals.reduce(function(s, v) { return s + v; }, 0) / vals.length : 0;
    return { vve: g.vve, avgWoz: avgWoz };
  }).filter(function(g) { return g.avgWoz > 0; });
  vvesMetWoz.sort(function(a, b) { return b.avgWoz - a.avgWoz; });
  var hoogsteGemWoz = vvesMetWoz[0];
  var laagsteGemWoz = vvesMetWoz[vvesMetWoz.length - 1];

  var metKvk = vves.filter(function(g) { return g.vve.kvknummer; })
    .sort(function(a, b) { return parseInt(a.vve.kvknummer) - parseInt(b.vve.kvknummer); });
  var laagsteKvk = metKvk[0];

  var fmt = function(n) { return n ? '\u20ac ' + Math.round(n).toLocaleString('nl-NL') : '-'; };
  var vveName = function(item) { return item.statutairenaam || item.vve_identificatie || '?'; };
  var addrStr = function(item) { return (item.straatnaam || '') + ' ' + (item.huisnummer || '') + ', ' + (item.postcode || ''); };

  var Card = function(props) {
    var clickable = !!props.onClick;
    return E('div', {
      onClick: props.onClick,
      onMouseEnter: clickable ? function(e){ e.currentTarget.style.background='#f1f5f9'; e.currentTarget.style.borderColor='#94a3b8'; } : undefined,
      onMouseLeave: clickable ? function(e){ e.currentTarget.style.background='#f8fafc'; e.currentTarget.style.borderColor='#e2e8f0'; } : undefined,
      style:{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8,padding:'12px 14px',display:'flex',flexDirection:'column',gap:4,cursor:clickable?'pointer':'default',transition:'background 0.12s,border-color 0.12s'}
    },
      E('div', {style:{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'#94a3b8'}}, props.label),
      E('div', {style:{fontSize:13,fontWeight:600,color:'#1e293b',lineHeight:1.3}}, props.main),
      props.sub && E('div', {style:{fontSize:11,color:'#64748b',marginTop:1}}, props.sub),
      props.badge && E('span', {
        style:{display:'inline-block',marginTop:3,padding:'1px 8px',borderRadius:10,fontSize:12,fontWeight:700,color:'white',background:LABEL_COLORS[props.badge]||'#ccc',width:'fit-content'}
      }, props.badge)
    );
  };

  var nav = function(item) { return item ? function(){ window.dispatchEvent(new CustomEvent('vve-navigate', { detail: item })); onClose(); } : function(){}; };

  return E('div', {
    style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:16},
    onClick: onClose
  }, E('div', {
    style:{background:'white',borderRadius:12,boxShadow:'0 8px 40px rgba(0,0,0,0.18)',width:'min(700px,100%)',maxHeight:'85vh',display:'flex',flexDirection:'column',overflow:'hidden'},
    onClick: function(e){e.stopPropagation();}
  },
    E('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid #e2e8f0',flexShrink:0}},
      E('div', null,
        E('h2', {style:{margin:0,fontSize:15,fontWeight:700,color:'#1e293b'}}, 'Opmerkelijke VvE\'s'),
        E('p', {style:{margin:0,fontSize:11,color:'#64748b',marginTop:2}}, 'Extremen op basis van alle ' + allData.length.toLocaleString('nl-NL') + ' adressen')
      ),
      E('button', {onClick:onClose,style:{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:20,lineHeight:1,padding:'2px 6px'}}, '\u00d7')
    ),
    E('div', {style:{padding:'16px 20px',overflowY:'auto',display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}},
      slechtsteLabel && E(Card, {label:'Slechtste gem. energielabel',main:vveName(slechtsteLabel.vve),sub:slechtsteLabel.addresses.length+' wooneenheden',badge:slechtsteLabel.label,onClick:nav(slechtsteLabel.vve)}),
      besteLabel && E(Card, {label:'Beste gem. energielabel',main:vveName(besteLabel.vve),sub:besteLabel.addresses.length+' wooneenheden',badge:besteLabel.label,onClick:nav(besteLabel.vve)}),
      duurste && E(Card, {label:'Duurste appartement (WOZ 2025)',main:fmt(duurste.woz2025),sub:addrStr(duurste),onClick:nav(duurste)}),
      goedkoopste && E(Card, {label:'Goedkoopste appartement (WOZ 2025)',main:fmt(goedkoopste.woz2025),sub:addrStr(goedkoopste),onClick:nav(goedkoopste)}),
      grootsteVve && E(Card, {label:'Grootste VvE',main:vveName(grootsteVve.vve),sub:grootsteVve.vve.aantal_woon_adr_in_vve+' adressen',onClick:nav(grootsteVve.vve)}),
      grootsteMetSlecht && E(Card, {label:'Grootste VvE met slechtste label',main:vveName(grootsteMetSlecht.vve),sub:grootsteMetSlecht.vve.aantal_woon_adr_in_vve+' adressen',badge:grootsteMetSlecht.label,onClick:nav(grootsteMetSlecht.vve)}),
      oudstePand && E(Card, {label:'Oudste pand',main:String(oudstePand.bouwjaar_gerelateerd_pand),sub:addrStr(oudstePand),onClick:nav(oudstePand)}),
      nieuwstePand && E(Card, {label:'Nieuwste pand',main:String(nieuwstePand.bouwjaar_gerelateerd_pand),sub:addrStr(nieuwstePand),onClick:nav(nieuwstePand)}),
      hoogsteGemWoz && E(Card, {label:'Hoogste gem. WOZ per VvE',main:fmt(hoogsteGemWoz.avgWoz),sub:vveName(hoogsteGemWoz.vve),onClick:nav(hoogsteGemWoz.vve)}),
      laagsteGemWoz && E(Card, {label:'Laagste gem. WOZ per VvE',main:fmt(laagsteGemWoz.avgWoz),sub:vveName(laagsteGemWoz.vve),onClick:nav(laagsteGemWoz.vve)}),
      laagsteKvk && E(Card, {label:'Laagste KvK-nummer',main:laagsteKvk.vve.kvknummer,sub:vveName(laagsteKvk.vve),onClick:nav(laagsteKvk.vve)})
    )
  ));
};

var DetailPanel = ({
  item,
  vveAddresses,
  onClose,
  onEnrichmentChange,
  crmConnected,
  onCrmUpdate,
  dossierVisible,
  gespikkeldLookup,
  showToolbarPortal = true,
  activeWozJaar,
  onSelectVve
}) => {
  var _useState3 = useState(false),
    _useState4 = _slicedToArray(_useState3, 2),
    showSummaryModal = _useState4[0],
    setShowSummaryModal = _useState4[1];
  var _useState5 = useState(false),
    _useState6 = _slicedToArray(_useState5, 2),
    showEditModal = _useState6[0],
    setShowEditModal = _useState6[1];
  var _useState7 = useState(false),
    _useState8 = _slicedToArray(_useState7, 2),
    showCrmModal = _useState8[0],
    setShowCrmModal = _useState8[1];
  var _useState9 = useState(false),
    _useState0 = _slicedToArray(_useState9, 2),
    showKvkLookupModal = _useState0[0],
    setShowKvkLookupModal = _useState0[1];
  var _useState1 = useState(false),
    _useState10 = _slicedToArray(_useState1, 2),
    copied = _useState10[0],
    setCopied = _useState10[1];
  var _useState11 = useState(null),
    _useState12 = _slicedToArray(_useState11, 2),
    enrichment = _useState12[0],
    setEnrichment = _useState12[1];
  var _useState13 = useState(null),
    _useState14 = _slicedToArray(_useState13, 2),
    crmRecord = _useState14[0],
    setCrmRecord = _useState14[1];
  var _useState21d = useState(false),
    _useState22d = _slicedToArray(_useState21d, 2),
    showHerbouwModal = _useState22d[0],
    setShowHerbouwModal = _useState22d[1];
  var _useState21dX = useState(false),
    _useState22dX = _slicedToArray(_useState21dX, 2),
    showExtreemModal = _useState22dX[0],
    setShowExtreemModal = _useState22dX[1];
  var _useState21e = useState(false),
    _useState22e = _slicedToArray(_useState21e, 2),
    showLabMenu = _useState22e[0],
    setShowLabMenu = _useState22e[1];
  var _useState21f = useState(null),
    _useState22f = _slicedToArray(_useState21f, 2),
    labMenuRect = _useState22f[0],
    setLabMenuRect = _useState22f[1];
  var _useState21g = useState(null),
    _useState22g = _slicedToArray(_useState21g, 2),
    pandFundering = _useState22g[0],
    setPandFundering = _useState22g[1];
  var _useStateOZ = useState(''),
    _useStateOZ2 = _slicedToArray(_useStateOZ, 2),
    ontwikkelzoneStr = _useStateOZ2[0],
    setOntwikkelzoneStr = _useStateOZ2[1];
  var _useStateMJGB = useState(''),
    _useStateMJGB2 = _slicedToArray(_useStateMJGB, 2),
    mjgbStr = _useStateMJGB2[0],
    setMjgbStr = _useStateMJGB2[1];
  var _useStateGW = useState(''),
    _useStateGW2 = _slicedToArray(_useStateGW, 2),
    grondwaterStr = _useStateGW2[0],
    setGrondwaterStr = _useStateGW2[1];
  var _useStateDT = useState('vve'),
    _useStateDT2 = _slicedToArray(_useStateDT, 2),
    activeDetailTab = _useStateDT2[0],
    setActiveDetailTab = _useStateDT2[1];

  // Laad verrijkte data en CRM bij mount of item change
  useEffect(() => {
    if (item?.vve_identificatie) {
      setEnrichment(getVveEnrichment(item.vve_identificatie));
      setCrmRecord(getCrmForVve(item.vve_identificatie));
    }
    setPandFundering(null);
  }, [item?.vve_identificatie]);

  // Haal funderingsdata op via kaart.haarlem.nl (data.haarlem.nl GeoServer WFS)
  // Via proxy om CORS te omzeilen (zie helpers/proxy_fundering.php op hbvoice.nl)
  const FUNDERING_PROXY = 'https://hbvoice.nl/proxy_fundering.php';
  useEffect(() => {
    var ids = [...new Set(vveAddresses.map(a => a.gerelateerd_pand_id).filter(Boolean))];
    if (!ids.length) return;
    fetch(FUNDERING_PROXY + '?pandids=' + ids.join(','))
      .then(r => r.json())
      .then(data => { setPandFundering(data.features || []); })
      .catch(() => {});
  }, [item?.vve_identificatie]);
  // Geocodeer adres via PDOK en bereken ontwikkelzone + MJGB voor geselecteerde VvE
  useEffect(() => {
    setOntwikkelzoneStr('');
    setMjgbStr('');
    setGrondwaterStr('');
    if (!item) return;
    var GZ=_GEO_ZONES,GM=_GEO_MJGB;
    var q=encodeURIComponent(item.straatnaam+' '+item.huisnummer+' '+item.postcode+' Haarlem');
    fetch('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q='+q+'&rows=1&fq=type:adres&fq=gemeentenaam:Haarlem')
    .then(r=>r.json())
    .then(d=>{
      var docs=d&&d.response&&d.response.docs;
      if(docs&&docs.length&&docs[0].centroide_ll){
        var m=docs[0].centroide_ll.match(/POINT\(([0-9.]+) ([0-9.]+)\)/);
        if(m){
          var lon=parseFloat(m[1]),lat=parseFloat(m[2]);
          function _gDistZ(z){var t=z.g.type;if(t==='Polygon')return _gDist(lon,lat,z.g.coordinates[0]);if(t==='MultiPolygon')return Math.min.apply(null,z.g.coordinates.map(function(p){return _gDist(lon,lat,p[0]);}));return Infinity;}
          function _fmtDist(d){return d<1?'in zone':Math.round(d)+'m';}
          var mz=[];GZ.forEach(function(z){var d=_gDistZ(z);if(d<=500)mz.push({n:z.n,d:d});});
          mz.sort(function(a,b){return a.d-b.d;});
          setOntwikkelzoneStr(mz.length?'Ja — '+mz.map(function(z){return z.n+' ('+_fmtDist(z.d)+')';}).join(', '):'Nee');
          var mm=[];GM.forEach(function(z){var d=_gDistZ(z);if(d<=500)mm.push({n:z.n,t:z.t,s:z.s,e:z.e,d:d});});
          mm.sort(function(a,b){return a.d-b.d;});
          setMjgbStr(mm.length?mm.map(function(z){return z.n+' ('+z.t+', '+z.s+'–'+z.e+', '+_fmtDist(z.d)+')';}).join('; '):'Nee');
          // Dichtstbijzijnde peilbuis
          var mLon2=111320*Math.cos(lat*Math.PI/180),mLat2=111320,pb=null,pbD=Infinity;
          _PEILBUIZEN.forEach(function(p){var dx=(p.lo-lon)*mLon2,dy=(p.la-lat)*mLat2,d=Math.sqrt(dx*dx+dy*dy);if(d<pbD){pbD=d;pb=p;}});
          if(pb&&pbD<=1000){var dep=pb.mv-pb.ws,mnd=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];var ds=pb.d?pb.d.split('-'):'';var datStr=ds.length===3?mnd[parseInt(ds[1])-1]+' '+ds[0]:'';setGrondwaterStr(Math.round(dep*100)/100+'m onder maaiveld ('+Math.round(pbD)+'m, '+datStr+')');}else{setGrondwaterStr('');}
        }
      }
    })
    .catch(function(){});
  }, [item?.vve_identificatie]);
  var liggingInfo = useMemo(() => getLiggingInfo(item), [item]);

  if (!item) return null;
  var grootte = getGrootteLabel(item.aantal_woon_adr_in_vve);
  var monumentLabel = getMonumentLabel(item.monumentale_status);
  var beschermdLabel = getBeschermdGezicht(item.vve_identificatie);
  var avgEnergy = getAverageEnergyLabel(vveAddresses);

  // Unieke pand IDs voor de VvE
  var uniquePandIds = [...new Set(vveAddresses.map(a => a.gerelateerd_pand_id).filter(Boolean))];

  // Bereken VvE statistieken voor de samenvatting
  var vveSummary = useMemo(() => {
    var woningen = vveAddresses.filter(a => a.basiseenheidtype?.toLowerCase().includes('woning') || a.basiseenheidtype?.toLowerCase().includes('appartement'));
    var nietWoningen = vveAddresses.filter(a => !a.basiseenheidtype?.toLowerCase().includes('woning') && !a.basiseenheidtype?.toLowerCase().includes('appartement'));

    // Adressen groeperen per straat en ranges maken
    var formatNrSuffix = a => {
      var s = `${a.huisnummer}`;
      if (a.huisletter) s += a.huisletter;
      if (a.huisnummertoevoeging) s += `-${a.huisnummertoevoeging}`;
      return s;
    };
    var straatGroepen = {};
    vveAddresses.forEach(a => {
      var straat = a.straatnaam || 'Onbekend';
      if (!straatGroepen[straat]) straatGroepen[straat] = [];
      straatGroepen[straat].push(a);
    });
    var adressenLijst = Object.keys(straatGroepen).sort().map(straat => {
      var adressen = straatGroepen[straat].sort((a, b) => {
        var numA = parseInt(a.huisnummer) || 0;
        var numB = parseInt(b.huisnummer) || 0;
        if (numA !== numB) return numA - numB;
        var letterA = (a.huisletter || '').toLowerCase();
        var letterB = (b.huisletter || '').toLowerCase();
        if (letterA !== letterB) return letterA.localeCompare(letterB);
        var toevA = (a.huisnummertoevoeging || '').toLowerCase();
        var toevB = (b.huisnummertoevoeging || '').toLowerCase();
        return toevA.localeCompare(toevB);
      });
      // Maak ranges van opeenvolgende huisnummers (alleen als ze geen letter/toevoeging hebben)
      var parts = [];
      var rangeStart = null;
      var rangePrev = null;
      var flushRange = () => {
        if (rangeStart !== null) {
          if (rangeStart === rangePrev) parts.push(`${rangeStart}`);else parts.push(`${rangeStart}-${rangePrev}`);
        }
      };
      adressen.forEach(a => {
        var num = parseInt(a.huisnummer) || 0;
        var hasExtra = a.huisletter || a.huisnummertoevoeging;
        if (hasExtra) {
          flushRange();
          rangeStart = null;
          rangePrev = null;
          parts.push(formatNrSuffix(a));
        } else {
          if (rangeStart === null) {
            rangeStart = num;
            rangePrev = num;
          } else if (num === rangePrev + 1 || num === rangePrev + 2) {
            rangePrev = num;
          } else {
            flushRange();
            rangeStart = num;
            rangePrev = num;
          }
        }
      });
      flushRange();
      return `${straat} ${parts.join(', ')}`;
    });

    // Bouwjaren
    var bouwjaren = [...new Set(vveAddresses.map(a => a.bouwjaar_gerelateerd_pand).filter(Boolean))].sort();
    var bouwjaarStr = bouwjaren.length === 1 ? bouwjaren[0] : bouwjaren.length > 1 ? `${bouwjaren[0]} - ${bouwjaren[bouwjaren.length - 1]}` : '-';

    // WOZ
    var wozValues = vveAddresses.map(a => getWozByYear(a, activeWozJaar)).filter(Boolean);
    var avgWoz = wozValues.length > 0 ? Math.round(wozValues.reduce((a, b) => a + b, 0) / wozValues.length) : 0;
    var minWoz = wozValues.length > 0 ? Math.min(...wozValues) : 0;
    var maxWoz = wozValues.length > 0 ? Math.max(...wozValues) : 0;

    // Labels
    var labelOrder = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
    var validLabels = vveAddresses.map(a => a.energielabel).filter(l => l && l !== '-');
    var labelScores = validLabels.map(l => {
      var idx = labelOrder.findIndex(o => l.startsWith(o.charAt(0)));
      return idx >= 0 ? idx : 10;
    });
    var minLabelScore = labelScores.length > 0 ? Math.min(...labelScores) : -1;
    var maxLabelScore = labelScores.length > 0 ? Math.max(...labelScores) : -1;
    var bestLabel = minLabelScore >= 0 ? labelOrder[minLabelScore] : '-';
    var worstLabel = maxLabelScore >= 0 ? labelOrder[maxLabelScore] : '-';

    // Woningtypen
    var woningtypen = [...new Set(vveAddresses.map(a => a.basiseenheidtype).filter(Boolean))].join(', ');

    // Warmte data
    var warmte = getWarmteProg(item);

    // Per-adres details (gesorteerd op huisnummer)
    var adresDetails = [...vveAddresses].sort((a, b) => {
      var nA = parseInt(a.huisnummer) || 0,
        nB = parseInt(b.huisnummer) || 0;
      if (nA !== nB) return nA - nB;
      return (a.huisletter || '').localeCompare(b.huisletter || '');
    });
    return {
      vveNaam: item.statutairenaam || '-',
      vveId: item.vve_identificatie || '-',
      kvkNummer: getKvkNummer(item, enrichment) || '-',
      pandIds: uniquePandIds,
      adressenLijst,
      adresDetails,
      aantalWoningen: item.aantal_woon_adr_in_vve || woningen.length,
      aantalNietWoning: nietWoningen.length,
      bouwjaar: bouwjaarStr,
      stadsdeel: item.stadsdeel || '-',
      wijk: item.wijk || '-',
      buurt: item.buurt || '-',
      gemWoz: formatCurrency(avgWoz),
      wozRange: minWoz === maxWoz ? formatCurrency(minWoz) : `${formatCurrency(minWoz)} – ${formatCurrency(maxWoz)}`,
      gemLabel: avgEnergy,
      labelRange: bestLabel === worstLabel ? bestLabel : `${bestLabel} – ${worstLabel}`,
      woningtypen: woningtypen || '-',
      monumentStatus: getMonumentLabel(item.monumentale_status) || '-',
      beschermd: getBeschermdGezicht(item.vve_identificatie) || '-',
      gespikkeldEntry: gespikkeldLookup[item.vve_identificatie] || null,
      wijkwarmteplan: warmte?.tijdvak || '-',
      warmtevoorziening: (getWarmteProg(item) || {}).warmte || '-'
    };
  }, [vveAddresses, item, uniquePandIds, avgEnergy]);
  var copyToClipboard = () => {
    var pandUrls = vveSummary.pandIds.map(id => `https://bagviewer.kadaster.nl/lvbag/bag-viewer/?objectId=${id}`).join('\n');
    var googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.straatnaam} ${item.huisnummer}, ${item.postcode} Haarlem`)}`;

    // Format bestuur info (alleen als enrichment enabled)
    var bestuurInfo = dossierVisible ? [enrichment?.bestuurNaam, enrichment?.bestuurEmail, enrichment?.bestuurTelefoon].filter(Boolean).join(', ') || '-' : null;
    var duurzaamheidInfo = dossierVisible ? [enrichment?.duurzaamheidNaam, enrichment?.duurzaamheidEmail, enrichment?.duurzaamheidTelefoon].filter(Boolean).join(', ') || '-' : null;
    var notitiesInfo = dossierVisible ? enrichment?.notities || '-' : null;

    // HTML tabel voor Word
    var beheerderInfo = dossierVisible ? enrichment?.beheerder || '-' : null;
    var enrichmentRows = dossierVisible ? `
<tr style="background-color:#e8f5e9;"><td style="border:1px solid #ccc;font-weight:bold;">Beheerder</td><td style="border:1px solid #ccc;">${beheerderInfo}</td></tr>
<tr style="background-color:#e8f5e9;"><td style="border:1px solid #ccc;font-weight:bold;">Contact bestuur</td><td style="border:1px solid #ccc;">${bestuurInfo}</td></tr>
<tr style="background-color:#e8f5e9;"><td style="border:1px solid #ccc;font-weight:bold;">Contact duurzaamheid</td><td style="border:1px solid #ccc;">${duurzaamheidInfo}</td></tr>
<tr style="background-color:#fff8e1;"><td style="border:1px solid #ccc;font-weight:bold;">Notities</td><td style="border:1px solid #ccc;">${notitiesInfo}</td></tr>` : '';
    var locatieStr = [vveSummary.buurt !== '-' && vveSummary.buurt, vveSummary.wijk !== '-' && vveSummary.wijk, vveSummary.stadsdeel !== '-' && vveSummary.stadsdeel].filter(Boolean).join(' · ') || '-';
    var beschermdStr = vveSummary.beschermd !== '-' ? `Ja (${vveSummary.beschermd})` : 'Nee';
    var ge = vveSummary.gespikkeldEntry;
    var gespikkeldStr = !ge ? 'Nee' : ge.gespikkeld ? 'Ja' : ge.pct_corporatie >= 100 ? 'Nee (volledig corporatie)' : 'Nee';
    var corpStr = ge ? ge.blok.map(b => `${b.corp_woningen} van ${b.woningen_in_blok} (${Math.round(b.corp_woningen / b.woningen_in_blok * 100)}%) — ${b.corporatie}`).join('; ') : '-';
    var adresDetailRows = vveSummary.adresDetails.map((a, idx) => {
      var adresStr = `${a.straatnaam || ''} ${a.huisnummer || ''}${a.huisletter || ''}${a.huisnummertoevoeging ? '-' + a.huisnummertoevoeging : ''}`.trim();
      var bg = idx % 2 === 0 ? '' : 'background-color:#f9fafb;';
      return `<tr style="${bg}"><td style="border:1px solid #ccc;">${adresStr}</td><td style="border:1px solid #ccc;">${a.basiseenheidtype || '-'}</td><td style="border:1px solid #ccc;">${getDisplayEnergyLabel(a)}</td><td style="border:1px solid #ccc;">${(getWozByYear(a, activeWozJaar)) ? (getWozByYear(a, activeWozJaar)).toLocaleString('nl-NL', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0
      }) : '-'}</td><td style="border:1px solid #ccc;">${a.bouwjaar_gerelateerd_pand || '-'}</td><td style="border:1px solid #ccc;">${a.oppervlakte ? a.oppervlakte + ' m²' : '-'}</td></tr>`;
    }).join('');
    var htmlTable = `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;">VvE-naam</td><td style="border:1px solid #ccc;">${vveSummary.vveNaam}</td></tr>
<tr><td style="border:1px solid #ccc;font-weight:bold;">VvE-ID</td><td style="border:1px solid #ccc;font-size:11px;">${vveSummary.vveId}</td></tr>
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;">KvK nummer</td><td style="border:1px solid #ccc;">${vveSummary.kvkNummer}</td></tr>
<tr><td style="border:1px solid #ccc;font-weight:bold;">Locatie</td><td style="border:1px solid #ccc;">${locatieStr}</td></tr>
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;vertical-align:top;">Gebouwidentificatie</td><td style="border:1px solid #ccc;">${vveSummary.pandIds.map(id => `<a href="https://bagviewer.kadaster.nl/lvbag/bag-viewer/?objectId=${id}">https://bagviewer.kadaster.nl/lvbag/bag-viewer/?objectId=${id}</a>`).join('<br>')}</td></tr>
<tr><td style="border:1px solid #ccc;font-weight:bold;">Google Maps</td><td style="border:1px solid #ccc;"><a href="${googleMapsUrl}">${googleMapsUrl}</a></td></tr>
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;vertical-align:top;">Adressen</td><td style="border:1px solid #ccc;">${vveSummary.adressenLijst.join('<br>')}</td></tr>
<tr><td style="border:1px solid #ccc;font-weight:bold;">Aantal woningen</td><td style="border:1px solid #ccc;">${vveSummary.aantalWoningen}</td></tr>
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;">Aantal adressen geen woning</td><td style="border:1px solid #ccc;">${vveSummary.aantalNietWoning}</td></tr>
<tr><td style="border:1px solid #ccc;font-weight:bold;">Bouwjaar/bouwjaren</td><td style="border:1px solid #ccc;">${vveSummary.bouwjaar}</td></tr>
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;">Gemiddelde WOZ</td><td style="border:1px solid #ccc;">${vveSummary.gemWoz}</td></tr>
<tr><td style="border:1px solid #ccc;font-weight:bold;">WOZ laag/hoog</td><td style="border:1px solid #ccc;">${vveSummary.wozRange}</td></tr>
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;">Gemiddeld label</td><td style="border:1px solid #ccc;">${vveSummary.gemLabel}</td></tr>
<tr><td style="border:1px solid #ccc;font-weight:bold;">Label laag/hoog</td><td style="border:1px solid #ccc;">${vveSummary.labelRange}</td></tr>
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;">Woningtypen</td><td style="border:1px solid #ccc;">${vveSummary.woningtypen}</td></tr>
<tr><td style="border:1px solid #ccc;font-weight:bold;">Monument</td><td style="border:1px solid #ccc;">${vveSummary.monumentStatus}</td></tr>
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;">Beschermd stadsgezicht</td><td style="border:1px solid #ccc;">${beschermdStr}</td></tr>
<tr><td style="border:1px solid #ccc;font-weight:bold;">Gespikkeld</td><td style="border:1px solid #ccc;">${gespikkeldStr}</td></tr>
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;">Corporatiewoningen</td><td style="border:1px solid #ccc;">${corpStr}</td></tr>
<tr><td style="border:1px solid #ccc;font-weight:bold;">Tijdvak</td><td style="border:1px solid #ccc;">${vveSummary.wijkwarmteplan}</td></tr>
<tr style="background-color:#f9fafb;"><td style="border:1px solid #ccc;font-weight:bold;">Warmte</td><td style="border:1px solid #ccc;">${vveSummary.warmtevoorziening}</td></tr>${enrichmentRows}
</table>
${vveSummary.adresDetails.length > 0 ? `<br><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin-top:8px;"><tr style="background-color:#f9fafb;"><th style="border:1px solid #ccc;">Adres</th><th style="border:1px solid #ccc;">Type</th><th style="border:1px solid #ccc;">Label</th><th style="border:1px solid #ccc;">WOZ</th><th style="border:1px solid #ccc;">Bouwjaar</th><th style="border:1px solid #ccc;">Opp.</th></tr>${adresDetailRows}</table>` : ''}`;

    // Plain text als fallback
    var enrichmentText = dossierVisible ? `
Beheerder\t${beheerderInfo}
Contact bestuur\t${bestuurInfo}
Contact duurzaamheid\t${duurzaamheidInfo}
Notities\t${notitiesInfo}` : '';
    var adresDetailTextRows = vveSummary.adresDetails.map(a => {
      var adresStr = `${a.straatnaam || ''} ${a.huisnummer || ''}${a.huisletter || ''}${a.huisnummertoevoeging ? '-' + a.huisnummertoevoeging : ''}`.trim();
      return `  ${adresStr}\t${a.basiseenheidtype || '-'}\t${getDisplayEnergyLabel(a)}\t${getWozByYear(a, activeWozJaar) || '-'}\t${a.bouwjaar_gerelateerd_pand || '-'}\t${a.oppervlakte ? a.oppervlakte + ' m²' : '-'}`;
    }).join('\n');
    var plainText = `VvE-naam\t${vveSummary.vveNaam}
VvE-ID\t${vveSummary.vveId}
KvK nummer\t${vveSummary.kvkNummer}
Locatie\t${locatieStr}
Gebouwidentificatie\t${pandUrls}
Google Maps\t${googleMapsUrl}
Adressen\t${vveSummary.adressenLijst.join(', ')}
Aantal woningen\t${vveSummary.aantalWoningen}
Aantal adressen geen woning\t${vveSummary.aantalNietWoning}
Bouwjaar/bouwjaren\t${vveSummary.bouwjaar}
Gemiddelde WOZ\t${vveSummary.gemWoz}
WOZ laag/hoog\t${vveSummary.wozRange}
Gemiddeld label\t${vveSummary.gemLabel}
Label laag/hoog\t${vveSummary.labelRange}
Woningtypen\t${vveSummary.woningtypen}
Monument\t${vveSummary.monumentStatus}
Beschermd stadsgezicht\t${beschermdStr}
Gespikkeld\t${gespikkeldStr}
Corporatiewoningen\t${corpStr}
Tijdvak\t${vveSummary.wijkwarmteplan}
Warmte\t${vveSummary.warmtevoorziening}${enrichmentText}${vveSummary.adresDetails.length > 0 ? `\n\nAdresdetails (adres\ttype\tlabel\twoz\tbouwjaar\toppervlakte):\n${adresDetailTextRows}` : ''}`;

    // Kopieer als HTML en plain text voor maximale compatibiliteit
    var blob = new Blob([htmlTable], {
      type: 'text/html'
    });
    var blobPlain = new Blob([plainText], {
      type: 'text/plain'
    });
    navigator.clipboard.write([new ClipboardItem({
      'text/html': blob,
      'text/plain': blobPlain
    })]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback naar plain text als HTML niet werkt
      navigator.clipboard.writeText(plainText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    });
  };
  var openStartdocument = () => {
    var warmte = getWarmteProg(item);
    var today = new Date();
    var datum = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    var bestuur = dossierVisible && enrichment ? [enrichment.bestuurNaam, enrichment.bestuurEmail, enrichment.bestuurTelefoon].filter(Boolean).join(', ') : '';
    var duurzaamheid = dossierVisible && enrichment ? [enrichment.duurzaamheidNaam, enrichment.duurzaamheidEmail, enrichment.duurzaamheidTelefoon].filter(Boolean).join(', ') : '';
    var bouwjaren = [...new Set(vveAddresses.map(a => a.bouwjaar_gerelateerd_pand).filter(Boolean))].sort();
    var bouwjaarStr = bouwjaren.length === 1 ? bouwjaren[0] : bouwjaren.length > 1 ? `${bouwjaren[0]} - ${bouwjaren[bouwjaren.length - 1]}` : '';
    var woningtypen = [...new Set(vveAddresses.map(a => a.basiseenheidtype).filter(Boolean))].join(', ');
    var wozValues = vveAddresses.map(a => getWozByYear(a, activeWozJaar)).filter(Boolean);
    var avgWoz = wozValues.length > 0 ? Math.round(wozValues.reduce((a, b) => a + b, 0) / wozValues.length) : 0;
    var isMonument = item.monumentale_status && !item.monumentale_status.toLowerCase().includes('geen') && !item.monumentale_status.toLowerCase().includes('waarschijnlijk');
    var beschermdGezicht = getBeschermdGezicht(item.vve_identificatie);
    var funderingStr = pandFundering !== null ? (pandFundering.length > 0 ? ([...new Set(pandFundering.map(f => f.properties.type_fundering).filter(Boolean))].join(', ') || 'onbekend type') : 'niet geregistreerd') : '';
    var pandIds = [...new Set(vveAddresses.map(a => a.gerelateerd_pand_id).filter(Boolean))];
    var pandLinks = pandIds.map(id => `<a href="https://bagviewer.kadaster.nl/lvbag/bag-viewer/?objectId=${id}" target="_blank">${id}</a>`).join('<br>');

    // Adressenlijst met ranges (hergebruik logica)
    var formatNr = a => {
      var s = `${a.huisnummer}`;
      if (a.huisletter) s += a.huisletter;
      if (a.huisnummertoevoeging) s += `-${a.huisnummertoevoeging}`;
      return s;
    };
    var sg = {};
    vveAddresses.forEach(a => {
      var str = a.straatnaam || 'Onbekend';
      if (!sg[str]) sg[str] = [];
      sg[str].push(a);
    });
    var adressenStr = Object.keys(sg).sort().map(straat => {
      var adr = sg[straat].sort((a, b) => {
        var nA = parseInt(a.huisnummer) || 0,
          nB = parseInt(b.huisnummer) || 0;
        if (nA !== nB) return nA - nB;
        return ((a.huisletter || '') + (a.huisnummertoevoeging || '')).localeCompare((b.huisletter || '') + (b.huisnummertoevoeging || ''));
      });
      var parts = [];
      var rs = null,
        rp = null;
      var flush = () => {
        if (rs !== null) parts.push(rs === rp ? `${rs}` : `${rs}-${rp}`);
      };
      adr.forEach(a => {
        var num = parseInt(a.huisnummer) || 0;
        if (a.huisletter || a.huisnummertoevoeging) {
          flush();
          rs = null;
          rp = null;
          parts.push(formatNr(a));
        } else {
          if (rs === null) {
            rs = num;
            rp = num;
          } else if (num <= rp + 2) {
            rp = num;
          } else {
            flush();
            rs = num;
            rp = num;
          }
        }
      });
      flush();
      return `${straat} ${parts.join(', ')}`;
    }).join('<br>');

    // c = checkbox helper (unicode, klikbaar), e = editable div helper (HTML-escaped), ehtml = editable div met vertrouwde HTML (bijv. <br> uit officiële dataset)
    if (typeof bouwStartdocument !== 'function') { alert('Het sjabloon voor het startdocument (document_sjabloon.js) is niet gevonden in de dashboardmap.'); return; } var html = bouwStartdocument({ item: item, enrichment: enrichment, warmte: warmte, datum: datum, bestuur: bestuur, duurzaamheid: duurzaamheid, bouwjaarStr: bouwjaarStr, woningtypen: woningtypen, avgWoz: avgWoz, avgEnergy: avgEnergy, isMonument: isMonument, beschermdGezicht: beschermdGezicht, funderingStr: funderingStr, ontwikkelzoneStr: ontwikkelzoneStr, mjgbStr: mjgbStr, grondwaterStr: grondwaterStr, pandIds: pandIds, adressenStr: adressenStr });;
    var newWindow = window.open('', '_blank');
    newWindow.document.write(html);
    newWindow.document.close();
    newWindow.focus();
  };
  // VvE-actieknoppen: staan normaal in de hoofdbalk bovenaan (portal), niet in dit
  // (smalle) detailpaneel. Alleen als er geen portal-doel is (mobiele weergave) worden ze
  // hier alsnog inline getoond.
  var actionButtons = [dossierVisible && /*#__PURE__*/React.createElement("button", {
    key: "bewerken",
    onClick: () => setShowEditModal(true),
    className: "flex items-center gap-1 px-2 py-0.5 hover:bg-pa-gray-200 text-pa-gray-600 hover:text-pa-gray-800 text-xs",
    style: enrichment ? {
      color: '#217346',
      background: '#e8f4ee',
      borderRadius: 2
    } : {},
    title: "VvE gegevens bewerken"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-3.5 h-3.5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
  })), "Bewerken"), crmConnected && /*#__PURE__*/React.createElement("button", {
    key: "crm",
    onClick: () => setShowCrmModal(true),
    className: "flex items-center gap-1 px-2 py-0.5 hover:bg-pa-gray-200 text-pa-gray-600 hover:text-pa-gray-800 text-xs",
    title: "CRM openen"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-3.5 h-3.5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
  })), "CRM"), /*#__PURE__*/React.createElement("button", {
    key: "kopieer",
    onClick: () => setShowSummaryModal(true),
    className: "flex items-center gap-1 px-2 py-0.5 hover:bg-pa-gray-200 text-pa-gray-600 hover:text-pa-gray-800 text-xs",
    title: "VvE samenvatting kopiëren"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-3.5 h-3.5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
  })), "Kopieer"), /*#__PURE__*/React.createElement("button", {
    key: "startdoc",
    onClick: openStartdocument,
    className: "flex items-center gap-1 px-2 py-0.5 hover:bg-pa-gray-200 text-pa-gray-600 hover:text-pa-gray-800 text-xs",
    title: "Startdocument openen"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-3.5 h-3.5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
  })), "Startdocument"), /*#__PURE__*/React.createElement("div", {
    key: "lab",
    className: "relative",
    style: {display: 'inline-block'}
  }, /*#__PURE__*/React.createElement("button", {
    onClick: function(e) { var r=e.currentTarget.getBoundingClientRect(); setLabMenuRect(r); setShowLabMenu(function(v){return !v;}); },
    className: "flex items-center gap-1 px-2 py-0.5 hover:bg-pa-gray-200 text-pa-gray-600 hover:text-pa-gray-800 text-xs",
    title: "Experimentele functies"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-3.5 h-3.5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
  })), "Uit het Lab", /*#__PURE__*/React.createElement("svg", {
    className: "w-2.5 h-2.5 ml-0.5",
    fill: "currentColor",
    viewBox: "0 0 20 20"
  }, /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z",
    clipRule: "evenodd"
  })))),
  showLabMenu && labMenuRect && ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    style:{position:'fixed',top:labMenuRect.bottom+2,right:window.innerWidth-labMenuRect.right,width:208,background:'white',border:'1px solid #d1d5db',boxShadow:'0 4px 16px rgba(0,0,0,0.12)',zIndex:9999},
    onMouseLeave: function(){setShowLabMenu(false);}
  }, /*#__PURE__*/React.createElement("button", {
    onClick: function(){ setShowHerbouwModal(true); setShowLabMenu(false); },
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-3.5 h-3.5 text-pa-gray-400 shrink-0",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
  })), "Herbouwwaarde")), document.body)];


  var toolbarTarget = showToolbarPortal && typeof document !== 'undefined' ? document.getElementById('vve-toolbar-actions') : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "bg-white"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 px-3 py-2 bg-pa-gray-100 border-b border-pa-gray-300 text-xs text-pa-gray-600"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", {
    className: "text-pa-gray-800"
  }, item.aantal_woon_adr_in_vve), " adressen", item._verdacht && /*#__PURE__*/React.createElement("span", {
    className: "ml-1 text-orange-500 cursor-help",
    title: `Brondata: ${item._brondata_aantal}, werkelijk: ${item._werkelijk_aantal}`
  }, "⚠")), /*#__PURE__*/React.createElement("span", {
    className: "text-pa-gray-300"
  }, "|"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", {
    className: "text-pa-gray-800"
  }, uniquePandIds.length), " pand", uniquePandIds.length !== 1 ? 'en' : ''), /*#__PURE__*/React.createElement("div", {
    className: "ml-auto flex gap-1 items-center"
  }, crmRecord && crmRecord.status !== 'nieuw' && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-pa-gray-600"
  }, CRM_STATUSES.find(s => s.key === crmRecord.status)?.label), !toolbarTarget && actionButtons, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "p-1 hover:bg-pa-gray-200 text-pa-gray-500 hover:text-pa-gray-700"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  }))))), toolbarTarget && ReactDOM.createPortal(/*#__PURE__*/React.createElement(React.Fragment, null, actionButtons), toolbarTarget), /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-2 border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "font-medium text-pa-gray-800"
  }, formatAddress(item)), /*#__PURE__*/React.createElement("p", {
    className: "text-pa-gray-500 text-xs"
  }, item.postcode, " Haarlem")), /*#__PURE__*/React.createElement("div", {
    className: "p-3 text-sm"
  }, /*#__PURE__*/React.createElement("div", {className: "flex border-b border-pa-gray-200 -mx-3 px-3 mb-1"}, /*#__PURE__*/React.createElement("button", {onClick: () => setActiveDetailTab('vve'), className: `px-3 py-2 text-xs font-medium border-b-2 -mb-px ${activeDetailTab === 'vve' ? 'border-pa-blue-500 text-pa-blue-600' : 'border-transparent text-pa-gray-500 hover:text-pa-gray-700'}`}, "VvE"), /*#__PURE__*/React.createElement("button", {onClick: () => setActiveDetailTab('appartement'), className: `px-3 py-2 text-xs font-medium border-b-2 -mb-px ${activeDetailTab === 'appartement' ? 'border-pa-blue-500 text-pa-blue-600' : 'border-transparent text-pa-gray-500 hover:text-pa-gray-700'}`}, "Appartement"), /*#__PURE__*/React.createElement("button", {onClick: () => setActiveDetailTab('dossier'), className: `px-3 py-2 text-xs font-medium border-b-2 -mb-px ${activeDetailTab === 'dossier' ? 'border-pa-blue-500 text-pa-blue-600' : 'border-transparent text-pa-gray-500 hover:text-pa-gray-700'}`}, "Dossier"), /*#__PURE__*/React.createElement("button", {onClick: () => setActiveDetailTab('pand'), className: `px-3 py-2 text-xs font-medium border-b-2 -mb-px ${activeDetailTab === 'pand' ? 'border-pa-blue-500 text-pa-blue-600' : 'border-transparent text-pa-gray-500 hover:text-pa-gray-700'}`}, "Pand"), uniquePandIds.length > 0 && /*#__PURE__*/React.createElement("button", {onClick: () => setActiveDetailTab('dakcheck'), className: `px-3 py-2 text-xs font-medium border-b-2 -mb-px ${activeDetailTab === 'dakcheck' ? 'border-pa-blue-500 text-pa-blue-600' : 'border-transparent text-pa-gray-500 hover:text-pa-gray-700'}`}, "Dakcheck")), activeDetailTab === 'appartement' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 w-24"
  }, "Bouwjaar"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, item.bouwjaar_gerelateerd_pand || '-'), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 w-16"
  }, "m²"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, item.oppervlakte)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "WOZ 2024"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, item.woz2024 ? formatCurrency(item.woz2024) : '-'), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "WOZ 2025"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, formatCurrency(item.woz2025))), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "WOZ 2026"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, item.woz2026 ? formatCurrency(item.woz2026) : '-'), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Label"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: `font-medium ${getEnergyClass(item.energielabel)}`
  }, item.energielabel || '-'))), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Type"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800",
    colSpan: "3"
  }, item.basiseenheidtype || '-')), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Locatie"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800",
    colSpan: "3"
  }, item.stadsdeel, " / ", item.wijk, " / ", item.buurt)), (monumentLabel || beschermdLabel) && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Erfgoed"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800",
    colSpan: "3"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex flex-wrap gap-1.5"
  }, monumentLabel && /*#__PURE__*/React.createElement("span", {
    className: "px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] rounded"
  }, monumentLabel), beschermdLabel && /*#__PURE__*/React.createElement("span", {
    className: "px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 text-[10px] rounded"
  }, "Beschermd stadsgezicht ", beschermdLabel)))), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Verblijfsobject"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5",
    colSpan: "3"
  }, item.verblijfsobject_id ? /*#__PURE__*/React.createElement("a", {
    href: `https://bagviewer.kadaster.nl/lvbag/bag-viewer/?objectId=${item.verblijfsobject_id}`,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "font-mono text-pa-blue-500 hover:underline"
  }, item.verblijfsobject_id) : '-')))), (() => {
    var warmte = getWarmteProg(item);
    if (!warmte) return null;
    return /*#__PURE__*/React.createElement("table", {
      className: "w-full text-xs"
    }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", {
      className: "border-b border-pa-gray-100"
    }, /*#__PURE__*/React.createElement("td", {
      className: "py-1.5 text-pa-gray-500 w-24"
    }, "Tijdvak"), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5 text-pa-gray-800"
    }, warmte?.tijdvak)), /*#__PURE__*/React.createElement("tr", {
      className: "border-b border-pa-gray-100"
    }, /*#__PURE__*/React.createElement("td", {
      className: "py-1.5 text-pa-gray-500"
    }, "Warmte"), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5 text-pa-gray-800"
    }, (getWarmteProg(item) || {}).warmte))));
  })(), liggingInfo?.floors && (() => {
    var E = React.createElement;
    var badges = [];
    if (liggingInfo.onderDak) badges.push(['Bovenste verdieping · onder het dak', 'bg-orange-50 border-orange-200 text-orange-800']);
    if (liggingInfo.beganeGrond) badges.push(['Begane grond', 'bg-blue-50 border-blue-200 text-blue-800']);
    if (liggingInfo.bovenOnverwarmd) badges.push([`Boven onverwarmde ruimte (${liggingInfo.onverwarmdOnder.map(u => u.basiseenheidtype).join(', ')})`, 'bg-orange-50 border-orange-200 text-orange-800']);
    if (liggingInfo.hoekDirect) badges.push(['Hoekwoning (BAG)', 'bg-purple-50 border-purple-200 text-purple-800']);
    if (liggingInfo.vrijstaandDirect) badges.push(['Vrijstaand/2-onder-1-kap (BAG)', 'bg-purple-50 border-purple-200 text-purple-800']);
    return E("div", {
      className: "border-t border-pa-gray-200 pt-3"
    }, E("div", {
      className: "text-xs font-medium text-pa-gray-500 uppercase tracking-wide mb-2"
    }, "Ligging (indicatief, o.b.v. BAG bouwlagen)"), E("div", {
      className: "flex flex-wrap gap-1.5"
    }, badges.length > 0 ? badges.map(([label, cls], i) => E("span", {
      key: i,
      className: `px-1.5 py-0.5 border text-[10px] rounded ${cls}`
    }, label)) : E("span", {
      className: "px-1.5 py-0.5 bg-pa-gray-100 border border-pa-gray-200 text-pa-gray-600 text-[10px] rounded"
    }, "Geen bijzondere ligging herkend (tussenverdieping/-woning)"), liggingInfo.indicatieveKopseGevel && E("span", {
      className: "px-1.5 py-0.5 border border-dashed border-pa-gray-300 text-pa-gray-500 text-[10px] rounded italic",
      title: "Gebaseerd op adresvolgorde binnen de bouwlaag \u2014 geen BAG-classificatie, kan onjuist zijn"
    }, "Mogelijk kopse ligging (indicatief)")));
  })()), activeDetailTab === 'vve' && /*#__PURE__*/React.createElement("div", {
    className: "border-t border-pa-gray-200 pt-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium text-pa-gray-500 uppercase tracking-wide mb-2"
  }, "VvE Gegevens"), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 w-24"
  }, "Naam"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, item.statutairenaam)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "KvK"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, (() => {
    var src = getKvkSource(item, enrichment);
    var nr = getKvkNummer(item, enrichment);
    if (!nr) return /*#__PURE__*/React.createElement("span", {
      className: "text-pa-gray-800"
    }, "-");
    return /*#__PURE__*/React.createElement("span", {
      className: "flex items-center gap-1.5"
    }, /*#__PURE__*/React.createElement("span", {
      className: `font-medium ${kvkSourceColor[src]}`
    }, nr), /*#__PURE__*/React.createElement("span", {
      className: `text-[9px] px-1 py-0.5 rounded border ${kvkSourceBg[src]}`
    }, kvkSourceLabel[src]));
  })())), item.vve_identificatie && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500",
    title: "Identificatienummer van de VvE bij het Kadaster. Dit is geen RSIN."
  }, "Kadaster-ID"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 font-mono text-pa-gray-800"
  }, String(item.vve_identificatie).replace(/^.*\./, ''))), isHoofdsplitsing(item) && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Splitsing"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800",
    title: HOOFDSPLITSING_UITLEG
  }, "Hoofdsplitsing", /*#__PURE__*/React.createElement("span", {
    className: "text-pa-gray-500"
  }, " \u00B7 ", item.aantal_app_rechten || '?', " rechten, onderverenigingen niet in de data"))), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Woonadressen"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, item.aantal_woon_adr_in_vve || 0)), (item.aantal_niet_woon_adr_in_vve || 0) > 0 && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Niet-woon"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, item.aantal_niet_woon_adr_in_vve)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Gem. label"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, /*#__PURE__*/React.createElement("span", {
    className: `font-medium ${getEnergyClass(avgEnergy)}`
  }, avgEnergy))), /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Kaart"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, /*#__PURE__*/React.createElement("a", {
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.straatnaam} ${item.huisnummer}, ${item.postcode} Haarlem`)}`,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "text-pa-blue-500 hover:underline"
  }, "Google Maps"))), MAPNAMEN_AAN && (() => {
    var naam = getMapnaam(item.vve_identificatie);
    if (!naam) return null;
    var url = dossierUrl(item.vve_identificatie);
    return /*#__PURE__*/React.createElement("tr", {
      className: "border-t border-pa-gray-100"
    }, /*#__PURE__*/React.createElement("td", {
      className: "py-1.5 text-pa-gray-500 align-top"
    }, "Dossiermap"), /*#__PURE__*/React.createElement("td", {
      className: "py-1.5"
    }, url ? /*#__PURE__*/React.createElement("a", {
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "text-pa-blue-500 hover:underline font-medium"
    }, "Map openen \u2197") : null, /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-pa-gray-500 mt-0.5 flex items-center gap-1.5"
    }, /*#__PURE__*/React.createElement("span", {
      className: "break-all"
    }, naam), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "xl-map-kopieer-los",
      title: "Mapnaam kopi\u00EBren",
      onClick: e => {
        e.stopPropagation();
        if (!navigator.clipboard) return;
        var knop = e.currentTarget;
        navigator.clipboard.writeText(naam).then(() => {
          knop.textContent = '\u2713';
          setTimeout(() => { knop.textContent = '\u29C9'; }, 1000);
        });
      }
    }, "\u29C9"))));
  })(), pandFundering !== null && /*#__PURE__*/React.createElement("tr", {className: "border-b border-pa-gray-100"}, /*#__PURE__*/React.createElement("td", {className: "py-1.5 text-pa-gray-500 w-24"}, "Fundering"), /*#__PURE__*/React.createElement("td", {className: "py-1.5"}, pandFundering.length === 0 ? /*#__PURE__*/React.createElement("span", {className: "text-pa-gray-400 italic"}, "niet geregistreerd") : /*#__PURE__*/React.createElement("a", {href: "https://kaart.haarlem.nl/?map=113", target: "_blank", rel: "noopener noreferrer", className: "text-pa-blue-500 hover:underline"}, [...new Set(pandFundering.map(f => f.properties.type_fundering).filter(Boolean))].join(', ') || "onbekend"))))), ontwikkelzoneStr && /*#__PURE__*/React.createElement("tr", {className: "border-b border-pa-gray-100"}, /*#__PURE__*/React.createElement("td", {className: "py-1.5 text-pa-gray-500 w-24 text-xs"}, "Ontwikkelzone"), /*#__PURE__*/React.createElement("td", {className: "py-1.5 text-xs"}, ontwikkelzoneStr)), mjgbStr && mjgbStr !== 'Nee' && /*#__PURE__*/React.createElement("tr", {className: "border-b border-pa-gray-100"}, /*#__PURE__*/React.createElement("td", {className: "py-1.5 text-pa-gray-500 w-24 text-xs"}, "MJGB"), /*#__PURE__*/React.createElement("td", {className: "py-1.5 text-xs"}, mjgbStr)), grondwaterStr && /*#__PURE__*/React.createElement("tr", {className: "border-b border-pa-gray-100"}, /*#__PURE__*/React.createElement("td", {className: "py-1.5 text-pa-gray-500 w-24 text-xs"}, "Grondwater"), /*#__PURE__*/React.createElement("td", {className: "py-1.5 text-xs"}, grondwaterStr))), activeDetailTab === 'pand' && uniquePandIds.length > 0 && /*#__PURE__*/React.createElement("div", {className: "border-t border-pa-gray-200 pt-3"}, /*#__PURE__*/React.createElement("div", {className: "text-xs font-medium text-pa-gray-500 uppercase tracking-wide mb-2"}, "Pand(en)"), /*#__PURE__*/React.createElement("div", {className: "flex flex-col gap-2"}, uniquePandIds.map((pandId) => /*#__PURE__*/React.createElement("a", {key: pandId, href: `https://bagviewer.kadaster.nl/lvbag/bag-viewer/?objectId=${pandId}`, target: "_blank", rel: "noopener noreferrer", className: "font-mono text-pa-blue-500 hover:underline text-xs"}, pandId)))), activeDetailTab === 'dossier' && dossierVisible && enrichment && /*#__PURE__*/React.createElement("div", {
    className: "border-t border-pa-gray-200 pt-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium text-pa-gray-500 uppercase tracking-wide mb-2"
  }, "Dossier"), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("tbody", null, enrichment.nickname && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 w-24"
  }, "Nickname"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800 font-medium"
  }, enrichment.nickname)), enrichment.adviestraject && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Adviestraject"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment.adviestraject)), enrichment.intake && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "1. Intake"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment.intake)), enrichment.bureau && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Bureau"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment.bureau)), enrichment.mwa && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "2. MWA"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment.mwa)), enrichment.verdieping && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "3. Verdieping"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment.verdieping)), enrichment.uitvoering && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "4. Uitvoering"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment.uitvoering)), enrichment.procesbegeleider && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Procesbegeleider"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment.procesbegeleider)), enrichment.beheerder && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Beheerder"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment.beheerder)), (enrichment.bestuurNaam || enrichment.bestuurEmail || enrichment.bestuurTelefoon) && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 w-24 align-top"
  }, "Bestuur"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment.bestuurNaam && /*#__PURE__*/React.createElement("div", null, enrichment.bestuurNaam), enrichment.bestuurEmail && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("a", {
    href: `mailto:${enrichment.bestuurEmail}`,
    className: "text-pa-blue-500 hover:underline"
  }, enrichment.bestuurEmail)), enrichment.bestuurTelefoon && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("a", {
    href: `tel:${enrichment.bestuurTelefoon}`,
    className: "text-pa-blue-500 hover:underline"
  }, enrichment.bestuurTelefoon)))), (enrichment.duurzaamheidNaam || enrichment.duurzaamheidEmail || enrichment.duurzaamheidTelefoon) && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 align-top"
  }, "Duurzaamheid"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment.duurzaamheidNaam && /*#__PURE__*/React.createElement("div", null, enrichment.duurzaamheidNaam), enrichment.duurzaamheidEmail && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("a", {
    href: `mailto:${enrichment.duurzaamheidEmail}`,
    className: "text-pa-blue-500 hover:underline"
  }, enrichment.duurzaamheidEmail)), enrichment.duurzaamheidTelefoon && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("a", {
    href: `tel:${enrichment.duurzaamheidTelefoon}`,
    className: "text-pa-blue-500 hover:underline"
  }, enrichment.duurzaamheidTelefoon)))), enrichment.notities && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 align-top"
  }, "Notities"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800 whitespace-pre-wrap"
  }, enrichment.notities)))))), activeDetailTab === 'dakcheck' && uniquePandIds.length > 0 && /*#__PURE__*/React.createElement("div", {style:{margin:'0 -12px -12px',position:'sticky',top:0}}, /*#__PURE__*/React.createElement("iframe", {src:'https://adresverkenner.nl/dakcheck/index.html?pandid='+uniquePandIds.join(',')+'&embedded',style:{width:'100%',height:'calc(100vh - 88px)',border:'none',display:'block'},title:'Dakcheck'}))  , showSummaryModal && ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-start justify-center pt-32 bg-black bg-opacity-30 overflow-y-auto",
    onClick: () => setShowSummaryModal(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "bg-white border border-pa-gray-300 max-w-lg w-full mx-4 my-4 max-h-[80vh] overflow-auto",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-3 py-2 bg-pa-gray-100 border-b border-pa-gray-300"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-sm font-medium text-pa-gray-700"
  }, "VvE Samenvatting"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: copyToClipboard,
    className: `px-2 py-1 text-xs border ${copied ? 'border-green-500 text-green-600' : 'border-pa-gray-300 text-pa-gray-600 hover:bg-pa-gray-50'}`
  }, copied ? 'Gekopieerd' : 'Kopieer'), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowSummaryModal(false),
    className: "p-1 hover:bg-pa-gray-200 text-pa-gray-500"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs border-collapse"
  }, /*#__PURE__*/React.createElement("tbody", null, /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 w-1/3"
  }, "VvE-naam"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800 font-medium"
  }, vveSummary.vveNaam)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "VvE-ID"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-600 font-mono text-[10px] break-all"
  }, vveSummary.vveId)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "KvK nummer"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.kvkNummer)), dossierVisible && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Contact bestuur"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment?.bestuurNaam || enrichment?.bestuurEmail || enrichment?.bestuurTelefoon ? [enrichment?.bestuurNaam, enrichment?.bestuurEmail, enrichment?.bestuurTelefoon].filter(Boolean).join(', ') : '-')), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Contact duurzaamheid"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, enrichment?.duurzaamheidNaam || enrichment?.duurzaamheidEmail || enrichment?.duurzaamheidTelefoon ? [enrichment?.duurzaamheidNaam, enrichment?.duurzaamheidEmail, enrichment?.duurzaamheidTelefoon].filter(Boolean).join(', ') : '-'))), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Locatie"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, [vveSummary.buurt !== '-' && vveSummary.buurt, vveSummary.wijk !== '-' && vveSummary.wijk, vveSummary.stadsdeel !== '-' && vveSummary.stadsdeel].filter(Boolean).join(' · ') || '-')), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 align-top"
  }, "Gebouwidentificatie"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.pandIds.map((pandId, idx) => /*#__PURE__*/React.createElement("div", {
    key: pandId
  }, /*#__PURE__*/React.createElement("a", {
    href: `https://bagviewer.kadaster.nl/lvbag/bag-viewer/?objectId=${pandId}`,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "text-pa-blue-500 hover:underline break-all"
  }, pandId))))), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Google Maps"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5"
  }, /*#__PURE__*/React.createElement("a", {
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.straatnaam} ${item.huisnummer}, ${item.postcode} Haarlem`)}`,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "text-pa-blue-500 hover:underline"
  }, "Bekijk locatie"))), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 align-top"
  }, "Adressen"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.adressenLijst.map((adres, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx
  }, adres)))), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Aantal woningen"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.aantalWoningen)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Niet-woningen"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.aantalNietWoning)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Bouwjaar"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.bouwjaar)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Gem. WOZ"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.gemWoz)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "WOZ bereik"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.wozRange)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Gem. label"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.gemLabel)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Label bereik"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.labelRange)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Woningtypen"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.woningtypen)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Monument"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.monumentStatus)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Beschermd stadsgezicht"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.beschermd !== '-' ? `Ja (${vveSummary.beschermd})` : 'Nee')), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Gespikkeld"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, (() => {
    var e = vveSummary.gespikkeldEntry;
    if (!e) return 'Nee';
    if (e.gespikkeld) return /*#__PURE__*/React.createElement("span", {
      className: "font-medium text-orange-600"
    }, "Ja");
    if (e.pct_corporatie >= 100) return /*#__PURE__*/React.createElement("span", {
      className: "text-pa-gray-500"
    }, "Nee (volledig corporatie)");
    return 'Nee';
  })())), vveSummary.gespikkeldEntry && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Corporatiewoningen"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.gespikkeldEntry.blok.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, b.corp_woningen, " van ", b.woningen_in_blok), /*#__PURE__*/React.createElement("span", {
    className: "text-pa-gray-500 ml-1"
  }, "(", Math.round(b.corp_woningen / b.woningen_in_blok * 100), "%)"), /*#__PURE__*/React.createElement("span", {
    className: "text-pa-gray-500 ml-1 text-xs"
  }, "— ", b.corporatie), b.data_kwaliteit && b.data_kwaliteit !== 'ok' && /*#__PURE__*/React.createElement("span", {
    className: "ml-1 text-orange-500 text-xs",
    title: b.data_kwaliteit
  }, "⚠ ", b.data_kwaliteit))))), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Tijdvak"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.wijkwarmteplan)), /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500"
  }, "Warmte"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800"
  }, vveSummary.warmtevoorziening)), dossierVisible && /*#__PURE__*/React.createElement("tr", {
    className: "border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-500 align-top"
  }, "Notities"), /*#__PURE__*/React.createElement("td", {
    className: "py-1.5 text-pa-gray-800 whitespace-pre-wrap"
  }, enrichment?.notities || '-')))), vveSummary.adresDetails.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium text-pa-gray-600 mb-1.5 pb-1 border-b border-pa-gray-200"
  }, "Adresdetails (", vveSummary.adresDetails.length, ")"), /*#__PURE__*/React.createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-[10px] border-collapse"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "bg-pa-gray-50 text-pa-gray-500"
  }, /*#__PURE__*/React.createElement("th", {
    className: "py-1 px-1.5 text-left font-medium border-b border-pa-gray-200"
  }, "Adres"), /*#__PURE__*/React.createElement("th", {
    className: "py-1 px-1.5 text-left font-medium border-b border-pa-gray-200"
  }, "Type"), /*#__PURE__*/React.createElement("th", {
    className: "py-1 px-1.5 text-right font-medium border-b border-pa-gray-200"
  }, "Label"), /*#__PURE__*/React.createElement("th", {
    className: "py-1 px-1.5 text-right font-medium border-b border-pa-gray-200"
  }, "WOZ 2024"), /*#__PURE__*/React.createElement("th", {
    className: "py-1 px-1.5 text-right font-medium border-b border-pa-gray-200"
  }, "WOZ 2025"), /*#__PURE__*/React.createElement("th", {
    className: "py-1 px-1.5 text-right font-medium border-b border-pa-gray-200"
  }, "Bouwjaar"), /*#__PURE__*/React.createElement("th", {
    className: "py-1 px-1.5 text-right font-medium border-b border-pa-gray-200"
  }, "Opp."))), /*#__PURE__*/React.createElement("tbody", null, vveSummary.adresDetails.map((a, idx) => {
    var adresStr = `${a.straatnaam || ''} ${a.huisnummer || ''}${a.huisletter || ''}${a.huisnummertoevoeging ? '-' + a.huisnummertoevoeging : ''}`.trim();
    return /*#__PURE__*/React.createElement("tr", {
      key: idx,
      className: `border-b border-pa-gray-100 ${idx % 2 === 0 ? '' : 'bg-pa-gray-50'}`
    }, /*#__PURE__*/React.createElement("td", {
      className: "py-1 px-1.5 text-pa-gray-800"
    }, adresStr), /*#__PURE__*/React.createElement("td", {
      className: "py-1 px-1.5 text-pa-gray-600 max-w-[80px] truncate",
      title: a.basiseenheidtype
    }, a.basiseenheidtype || '-'), /*#__PURE__*/React.createElement("td", {
      className: `py-1 px-1.5 text-right font-medium ${getEnergyClass(getDisplayEnergyLabel(a))}`
    }, getDisplayEnergyLabel(a)), /*#__PURE__*/React.createElement("td", {
      className: "py-1 px-1.5 text-right text-pa-gray-700"
    }, a.woz2024 ? formatCurrency(a.woz2024) : '-'), /*#__PURE__*/React.createElement("td", {
      className: "py-1 px-1.5 text-right text-pa-gray-700"
    }, a.woz2025 ? formatCurrency(a.woz2025) : '-'), /*#__PURE__*/React.createElement("td", {
      className: "py-1 px-1.5 text-right text-pa-gray-600"
    }, a.bouwjaar_gerelateerd_pand || '-'), /*#__PURE__*/React.createElement("td", {
      className: "py-1 px-1.5 text-right text-pa-gray-600"
    }, a.oppervlakte ? `${a.oppervlakte} m²` : '-'));
  })))))))), document.body), dossierVisible && showEditModal && ReactDOM.createPortal(/*#__PURE__*/React.createElement(EditDossierModal, {
    vveId: item.vve_identificatie,
    vveNaam: item.statutairenaam,
    initialData: enrichment,
    onSave: data => {
      setVveEnrichment(item.vve_identificatie, data);
      setEnrichment(data);
      setShowEditModal(false);
      if (onEnrichmentChange) onEnrichmentChange();
    },
    onClose: () => setShowEditModal(false)
  }), document.body), showCrmModal && ReactDOM.createPortal(/*#__PURE__*/React.createElement(CrmModal, {
    vveId: item.vve_identificatie,
    vveNaam: item.statutairenaam,
    onClose: () => setShowCrmModal(false),
    onUpdate: () => {
      setCrmRecord(getCrmForVve(item.vve_identificatie));
      if (onCrmUpdate) onCrmUpdate();
    }
  }), document.body), showKvkLookupModal && ReactDOM.createPortal(/*#__PURE__*/React.createElement(KvkLookupModal, {
    vveNaam: item.statutairenaam,
    onSave: kvkNummer => {
      var currentEnrichment = enrichment || {};
      var updated = {
        ...currentEnrichment,
        kvkNummer
      };
      setVveEnrichment(item.vve_identificatie, updated);
      setEnrichment(updated);
      setShowKvkLookupModal(false);
      if (onEnrichmentChange) onEnrichmentChange();
    },
    onClose: () => setShowKvkLookupModal(false)
  }), document.body), showHerbouwModal && ReactDOM.createPortal(/*#__PURE__*/React.createElement(HerbouwwaardeModal, {
    item: item,
    vveAddresses: vveAddresses,
    onClose: () => setShowHerbouwModal(false)
  }), document.body), showExtreemModal && ReactDOM.createPortal(/*#__PURE__*/React.createElement(ExtreemModal, {
    onClose: () => setShowExtreemModal(false)
  }), document.body));
};

// Edit Dossier Modal Component
var EditDossierModal = ({
  vveId,
  vveNaam,
  initialData,
  onSave,
  onClose
}) => {
  var _useState15 = useState({
      nickname: initialData?.nickname || '',
      kvkNummer: initialData?.kvkNummer || '',
      adviestraject: initialData?.adviestraject || '',
      intake: initialData?.intake || '',
      bureau: initialData?.bureau || '',
      mwa: initialData?.mwa || '',
      verdieping: initialData?.verdieping || '',
      uitvoering: initialData?.uitvoering || '',
      procesbegeleider: initialData?.procesbegeleider || '',
      beheerder: initialData?.beheerder || '',
      bestuurNaam: initialData?.bestuurNaam || '',
      bestuurEmail: initialData?.bestuurEmail || '',
      bestuurTelefoon: initialData?.bestuurTelefoon || '',
      duurzaamheidNaam: initialData?.duurzaamheidNaam || '',
      duurzaamheidEmail: initialData?.duurzaamheidEmail || '',
      duurzaamheidTelefoon: initialData?.duurzaamheidTelefoon || '',
      notities: initialData?.notities || ''
    }),
    _useState16 = _slicedToArray(_useState15, 2),
    formData = _useState16[0],
    setFormData = _useState16[1];
  var handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  var handleSubmit = e => {
    e.preventDefault();
    onSave(formData);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "pa-card max-w-lg w-full mx-4 max-h-[90vh] overflow-auto",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3 border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold text-pa-gray-800"
  }, "VvE Dossier"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "p-1 hover:bg-pa-gray-100 rounded"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-5 h-5 text-pa-gray-500",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  })))), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "p-4 space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-pa-gray-500 mb-2"
  }, vveNaam), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-pa-gray-700 mb-1"
  }, "Nickname"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Korte werknaam voor deze VvE",
    value: formData.nickname,
    onChange: e => handleChange('nickname', e.target.value),
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-pa-gray-500 mb-1"
  }, "KvK nummer"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "bijv. 12345678",
    value: formData.kvkNummer,
    onChange: e => handleChange('kvkNummer', e.target.value.replace(/\D/g, '').slice(0, 8)),
    maxLength: 8,
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => {
      navigator.clipboard.writeText(vveNaam || '');
      window.open('https://www.kvk.nl/zoeken/?source=handelsregister', '_blank');
    },
    className: "mt-1 text-xs text-blue-600 hover:underline flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-3 h-3",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
  })), "Zoek op KvK.nl → (kopieert VvE-naam)")), /*#__PURE__*/React.createElement("div", {
    className: "border border-pa-gray-200 rounded p-3"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "font-medium text-pa-gray-700 mb-3 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
  })), "Traject"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, [{
    field: 'adviestraject',
    label: 'Adviestraject',
    opties: ADVIESTRAJECT_OPTIES
  }, {
    field: 'bureau',
    label: 'Bureau',
    opties: BUREAU_OPTIES
  }, {
    field: 'procesbegeleider',
    label: 'Procesbegeleider',
    opties: PROCESBEGELEIDER_OPTIES
  }].map(({
    field,
    label,
    opties
  }) => /*#__PURE__*/React.createElement("div", {
    key: field,
    className: "col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-pa-gray-500 mb-1"
  }, label), /*#__PURE__*/React.createElement("select", {
    value: formData[field],
    onChange: e => handleChange(field, e.target.value),
    className: "w-full px-2 py-1.5 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "—"), opties.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o))))), /*#__PURE__*/React.createElement("div", {
    className: "col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-pa-gray-500 mb-1"
  }, "Beheerder"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Naam beheerder",
    value: formData.beheerder,
    onChange: e => handleChange('beheerder', e.target.value),
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  })), [{
    field: 'intake',
    label: '1. Intake',
    opties: INTAKE_OPTIES
  }, {
    field: 'mwa',
    label: '2. MWA',
    opties: FASE_OPTIES
  }, {
    field: 'verdieping',
    label: '3. Verdieping',
    opties: FASE_OPTIES
  }, {
    field: 'uitvoering',
    label: '4. Uitvoering',
    opties: FASE_OPTIES
  }].map(({
    field,
    label,
    opties
  }) => /*#__PURE__*/React.createElement("div", {
    key: field
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs text-pa-gray-500 mb-1"
  }, label), /*#__PURE__*/React.createElement("select", {
    value: formData[field],
    onChange: e => handleChange(field, e.target.value),
    className: "w-full px-2 py-1.5 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "—"), opties.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o))))))), /*#__PURE__*/React.createElement("div", {
    className: "border border-pa-gray-200 rounded p-3"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "font-medium text-pa-gray-700 mb-3 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
  })), "Contactgegevens Bestuur"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Naam",
    value: formData.bestuurNaam,
    onChange: e => handleChange('bestuurNaam', e.target.value),
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  }), /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "E-mailadres",
    value: formData.bestuurEmail,
    onChange: e => handleChange('bestuurEmail', e.target.value),
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  }), /*#__PURE__*/React.createElement("input", {
    type: "tel",
    placeholder: "Telefoonnummer",
    value: formData.bestuurTelefoon,
    onChange: e => handleChange('bestuurTelefoon', e.target.value),
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "border border-pa-gray-200 rounded p-3"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "font-medium text-pa-gray-700 mb-3 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
  })), "Contactgegevens Duurzaamheidscommissie"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    placeholder: "Naam",
    value: formData.duurzaamheidNaam,
    onChange: e => handleChange('duurzaamheidNaam', e.target.value),
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  }), /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "E-mailadres",
    value: formData.duurzaamheidEmail,
    onChange: e => handleChange('duurzaamheidEmail', e.target.value),
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  }), /*#__PURE__*/React.createElement("input", {
    type: "tel",
    placeholder: "Telefoonnummer",
    value: formData.duurzaamheidTelefoon,
    onChange: e => handleChange('duurzaamheidTelefoon', e.target.value),
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-sm font-medium text-pa-gray-700 mb-1"
  }, "Notities"), /*#__PURE__*/React.createElement("textarea", {
    placeholder: "Vrije notities over deze VvE...",
    value: formData.notities,
    onChange: e => handleChange('notities', e.target.value),
    rows: 3,
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 pt-2"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    className: "px-4 py-2 text-sm text-pa-gray-600 hover:bg-pa-gray-100 rounded"
  }, "Annuleren"), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "px-4 py-2 text-sm bg-pa-purple-500 text-white rounded hover:bg-pa-purple-600 pa-button"
  }, "Opslaan")))));
};

// KvK Lookup Modal Component
// Helper: maak slimme zoekopdracht van VvE naam
var makeSmartKvkQuery = naam => {
  var stopwoorden = ['vereniging', 'van', 'eigenaars', 'eigenaren', 'vve', 'de', 'het', 'een', 'te', 'den', 'der'];
  var woorden = naam.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w && !stopwoorden.includes(w));
  return woorden.length > 0 ? 'vereniging ' + woorden.join(' ') : naam;
};
var KvkLookupModal = ({
  vveNaam,
  onSave,
  onClose
}) => {
  var _useState17 = useState(''),
    _useState18 = _slicedToArray(_useState17, 2),
    manualKvk = _useState18[0],
    setManualKvk = _useState18[1];
  var isValid = manualKvk && /^\d{8}$/.test(manualKvk);
  var pasteFromClipboard = async () => {
    try {
      var text = await navigator.clipboard.readText();
      var digits = text.trim().replace(/\D/g, '');
      if (/^\d{8}$/.test(digits)) setManualKvk(digits);
    } catch (e) {/* clipboard niet beschikbaar */}
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "pa-card max-w-sm w-full mx-4",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3 border-b border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold text-pa-gray-800"
  }, "KvK Nummer Invoeren"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "p-1 hover:bg-pa-gray-100 rounded"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-5 h-5 text-pa-gray-500",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "p-4 space-y-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-pa-gray-500"
  }, vveNaam), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: manualKvk,
    onChange: e => {
      var v = e.target.value.replace(/\D/g, '').slice(0, 8);
      setManualKvk(v);
    },
    placeholder: "KvK nummer (8 cijfers)",
    maxLength: "8",
    autoFocus: true,
    onKeyDown: e => e.key === 'Enter' && isValid && onSave(manualKvk),
    className: "flex-1 px-3 py-2 border border-pa-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: pasteFromClipboard,
    title: "Plak KvK-nummer uit klembord",
    className: "px-3 py-2 text-sm border border-pa-gray-200 rounded hover:bg-pa-gray-100 text-pa-gray-600 whitespace-nowrap"
  }, "📋 Plak")), manualKvk && !isValid && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-red-500"
  }, "KvK nummer moet 8 cijfers zijn")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 px-4 py-3 border-t border-pa-gray-200"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "px-4 py-2 text-sm text-pa-gray-600 hover:bg-pa-gray-100 rounded"
  }, "Annuleren"), /*#__PURE__*/React.createElement("button", {
    onClick: () => isValid && onSave(manualKvk),
    disabled: !isValid,
    className: `px-4 py-2 text-sm text-white rounded ${isValid ? 'bg-pa-purple-500 hover:bg-pa-purple-600 pa-button' : 'bg-pa-gray-300 cursor-not-allowed'}`
  }, "Opslaan"))));
};

// CRM Modal Component
var CrmModal = ({
  vveId,
  vveNaam,
  onClose,
  onUpdate
}) => {
  var _useState19 = useState(getCrmForVve(vveId) || {
      status: 'nieuw',
      prioriteit: 'normaal',
      toegewezenAan: '',
      volgendeActie: '',
      volgendeActieDeadline: '',
      contactmomenten: []
    }),
    _useState20 = _slicedToArray(_useState19, 2),
    crmRecord = _useState20[0],
    setCrmRecord = _useState20[1];
  var _useState21 = useState({
      type: 'notitie',
      notitie: '',
      doorWie: TEAM_MEMBERS[0]
    }),
    _useState22 = _slicedToArray(_useState21, 2),
    newContact = _useState22[0],
    setNewContact = _useState22[1];
  var _useState23 = useState(false),
    _useState24 = _slicedToArray(_useState23, 2),
    showAddContact = _useState24[0],
    setShowAddContact = _useState24[1];
  var handleFieldChange = async (field, value) => {
    var updated = {
      ...crmRecord,
      [field]: value
    };
    setCrmRecord(updated);
    await setCrmForVve(vveId, updated);
    if (onUpdate) onUpdate();
  };
  var handleAddContact = async () => {
    if (!newContact.notitie.trim()) return;
    await addContactMoment(vveId, newContact);
    setCrmRecord(getCrmForVve(vveId));
    setNewContact({
      type: 'notitie',
      notitie: '',
      doorWie: TEAM_MEMBERS[0]
    });
    setShowAddContact(false);
    if (onUpdate) onUpdate();
  };
  var handleDeleteContact = async contactId => {
    if (confirm('Weet je zeker dat je dit contactmoment wilt verwijderen?')) {
      await deleteContactMoment(vveId, contactId);
      setCrmRecord(getCrmForVve(vveId));
      if (onUpdate) onUpdate();
    }
  };
  var getStatusInfo = key => CRM_STATUSES.find(s => s.key === key) || CRM_STATUSES[0];
  var getPriorityInfo = key => CRM_PRIORITIES.find(p => p.key === key) || CRM_PRIORITIES[1];
  var getContactTypeInfo = key => CONTACT_TYPES.find(t => t.key === key) || CONTACT_TYPES[4];
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "pa-card max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-4 py-3 border-b border-pa-gray-200 bg-gradient-to-r from-pa-purple-500 to-pa-blue-500"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold text-white"
  }, "CRM - VvE Beheer"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-white text-opacity-80 truncate max-w-md"
  }, vveNaam)), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "p-1 hover:bg-white/20 rounded text-white"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-5 h-5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto p-4 space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-medium text-pa-gray-500 mb-1"
  }, "Status"), /*#__PURE__*/React.createElement("select", {
    value: crmRecord.status,
    onChange: e => handleFieldChange('status', e.target.value),
    className: `w-full px-3 py-2 rounded text-sm font-medium ${getStatusInfo(crmRecord.status).color} border-0 cursor-pointer`
  }, CRM_STATUSES.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.key,
    value: s.key
  }, s.label)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-medium text-pa-gray-500 mb-1"
  }, "Prioriteit"), /*#__PURE__*/React.createElement("select", {
    value: crmRecord.prioriteit,
    onChange: e => handleFieldChange('prioriteit', e.target.value),
    className: `w-full px-3 py-2 rounded text-sm font-medium ${getPriorityInfo(crmRecord.prioriteit).color} border-0 cursor-pointer`
  }, CRM_PRIORITIES.map(p => /*#__PURE__*/React.createElement("option", {
    key: p.key,
    value: p.key
  }, p.label))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-medium text-pa-gray-500 mb-1"
  }, "Toegewezen aan"), /*#__PURE__*/React.createElement("select", {
    value: crmRecord.toegewezenAan,
    onChange: e => handleFieldChange('toegewezenAan', e.target.value),
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm"
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "-- Niet toegewezen --"), TEAM_MEMBERS.map(m => /*#__PURE__*/React.createElement("option", {
    key: m,
    value: m
  }, m)))), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-span-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-medium text-pa-gray-500 mb-1"
  }, "Volgende actie"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    value: crmRecord.volgendeActie,
    onChange: e => handleFieldChange('volgendeActie', e.target.value),
    placeholder: "Bijv. Bellen voor afspraak...",
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    className: "block text-xs font-medium text-pa-gray-500 mb-1"
  }, "Deadline"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: crmRecord.volgendeActieDeadline,
    onChange: e => handleFieldChange('volgendeActieDeadline', e.target.value),
    className: "w-full px-3 py-2 border border-pa-gray-200 rounded text-sm"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-xs font-medium text-pa-gray-500"
  }, "Contactmomenten"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowAddContact(!showAddContact),
    className: "text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
  }, "+ Toevoegen")), showAddContact && /*#__PURE__*/React.createElement("div", {
    className: "bg-indigo-50 rounded p-3 mb-3 space-y-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, /*#__PURE__*/React.createElement("select", {
    value: newContact.type,
    onChange: e => setNewContact({
      ...newContact,
      type: e.target.value
    }),
    className: "px-2 py-1.5 border border-pa-gray-200 rounded text-sm"
  }, CONTACT_TYPES.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.key,
    value: t.key
  }, t.icon, " ", t.label))), /*#__PURE__*/React.createElement("select", {
    value: newContact.doorWie,
    onChange: e => setNewContact({
      ...newContact,
      doorWie: e.target.value
    }),
    className: "px-2 py-1.5 border border-pa-gray-200 rounded text-sm"
  }, TEAM_MEMBERS.map(m => /*#__PURE__*/React.createElement("option", {
    key: m,
    value: m
  }, m)))), /*#__PURE__*/React.createElement("textarea", {
    value: newContact.notitie,
    onChange: e => setNewContact({
      ...newContact,
      notitie: e.target.value
    }),
    placeholder: "Beschrijving van het contactmoment...",
    rows: 2,
    className: "w-full px-2 py-1.5 border border-pa-gray-200 rounded text-sm"
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowAddContact(false),
    className: "px-3 py-1 text-xs text-pa-gray-600 hover:bg-pa-gray-100 rounded"
  }, "Annuleren"), /*#__PURE__*/React.createElement("button", {
    onClick: handleAddContact,
    className: "px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
  }, "Opslaan"))), /*#__PURE__*/React.createElement("div", {
    className: "space-y-2 max-h-48 overflow-y-auto"
  }, (crmRecord.contactmomenten || []).length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-pa-gray-400 italic py-2"
  }, "Nog geen contactmomenten") : crmRecord.contactmomenten.map(contact => /*#__PURE__*/React.createElement("div", {
    key: contact.id,
    className: "bg-pa-gray-50 rounded p-2 text-xs group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", null, getContactTypeInfo(contact.type).icon), /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, getContactTypeInfo(contact.type).label), /*#__PURE__*/React.createElement("span", {
    className: "text-pa-gray-400"
  }, "•"), /*#__PURE__*/React.createElement("span", {
    className: "text-pa-gray-500"
  }, contact.doorWie)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-pa-gray-400"
  }, new Date(contact.timestamp).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => handleDeleteContact(contact.id),
    className: "opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-3 h-3",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  }))))), /*#__PURE__*/React.createElement("p", {
    className: "mt-1 text-pa-gray-600 whitespace-pre-wrap"
  }, contact.notitie)))))), /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-3 border-t border-pa-gray-200 bg-pa-gray-50 text-xs text-pa-gray-400"
  }, crmRecord.lastModified && /*#__PURE__*/React.createElement("span", null, "Laatst gewijzigd: ", new Date(crmRecord.lastModified).toLocaleString('nl-NL')))));
};

// Pagination component
var Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange
}) => /*#__PURE__*/React.createElement("div", {
  className: "flex items-center justify-between pa-card p-2 mt-3"
}, /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-2"
}, /*#__PURE__*/React.createElement("span", {
  className: "text-xs text-pa-gray-500"
}, "Per pagina:"), /*#__PURE__*/React.createElement("select", {
  value: pageSize,
  onChange: e => onPageSizeChange(Number(e.target.value)),
  className: "border border-pa-gray-300 rounded px-2 py-1 text-xs focus:border-pa-blue-500 focus:ring-1 focus:ring-pa-blue-500"
}, /*#__PURE__*/React.createElement("option", {
  value: 25
}, "25"), /*#__PURE__*/React.createElement("option", {
  value: 50
}, "50"), /*#__PURE__*/React.createElement("option", {
  value: 100
}, "100"))), /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-2"
}, /*#__PURE__*/React.createElement("button", {
  onClick: () => onPageChange(currentPage - 1),
  disabled: currentPage === 1,
  className: "px-3 py-1 rounded border border-pa-gray-300 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pa-gray-50 text-pa-gray-700 pa-button"
}, "Vorige"), /*#__PURE__*/React.createElement("span", {
  className: "text-xs text-pa-gray-600 tabular-nums"
}, currentPage, " / ", totalPages), /*#__PURE__*/React.createElement("button", {
  onClick: () => onPageChange(currentPage + 1),
  disabled: currentPage === totalPages,
  className: "px-3 py-1 rounded border border-pa-gray-300 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-pa-gray-50 text-pa-gray-700 pa-button"
}, "Volgende")));

// Toggle switch component
var ToggleSwitch = ({
  leftLabel,
  rightLabel,
  isRight,
  onChange
}) => /*#__PURE__*/React.createElement("div", {
  className: "flex items-center gap-1.5 text-xs"
}, /*#__PURE__*/React.createElement("span", {
  className: `${isRight ? 'text-pa-gray-400' : 'text-pa-gray-700 font-medium'}`
}, leftLabel), /*#__PURE__*/React.createElement("button", {
  onClick: () => onChange(!isRight),
  className: `relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${isRight ? 'bg-pa-purple-500' : 'bg-pa-gray-300'}`
}, /*#__PURE__*/React.createElement("span", {
  className: `absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${isRight ? 'translate-x-4' : 'translate-x-0.5'}`
})), /*#__PURE__*/React.createElement("span", {
  className: `${isRight ? 'text-pa-gray-700 font-medium' : 'text-pa-gray-400'}`
}, rightLabel));

// Dossier keuzelijsten — globaal zodat EditDossierModal er ook bij kan
var ADVIESTRAJECT_OPTIES = ['Isolatie', 'Gasvrij', 'Integraal aardgasvrij', 'Pre-advies'];
var BUREAU_OPTIES = ['steeds', 'energiek', 'dwtm', 'merosch', 'huizendokter', 'klerk engineering', 'duurzaamenergieloket'];
var FASE_OPTIES = ['gestart', 'afgerond', 'gestopt'];
var INTAKE_OPTIES = ['wachtlijst', 'gestart', 'afgerond', 'gestopt'];
if (typeof PROCESBEGELEIDER_OPTIES === 'undefined') { window.PROCESBEGELEIDER_OPTIES = ['Overig']; }

// Main App
var App = () => {
  // === Expiry check ===
  var _useState25 = useState(isAppExpired() && !isActivated()),
    _useState26 = _slicedToArray(_useState25, 2),
    expired = _useState26[0],
    setExpired = _useState26[1];
  var _useState27 = useState(''),
    _useState28 = _slicedToArray(_useState27, 2),
    activationKey = _useState28[0],
    setActivationKey = _useState28[1];
  var _useState29 = useState(false),
    _useState30 = _slicedToArray(_useState29, 2),
    activationError = _useState30[0],
    setActivationError = _useState30[1];
  if (expired) {
    return /*#__PURE__*/React.createElement("div", {
      className: "min-h-screen bg-pa-gray-100 font-segoe flex items-center justify-center"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-8 text-center"
    }, /*#__PURE__*/React.createElement("div", {
      className: "w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center"
    }, /*#__PURE__*/React.createElement("svg", {
      className: "w-8 h-8 text-red-500",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364l-1.414 1.414M21 12h-2M5 12H3m2.636-5.364L4.222 5.222M12 3v2"
    }))), /*#__PURE__*/React.createElement("h1", {
      className: "text-xl font-bold text-gray-800 mb-2"
    }, "VvE Dashboard verlopen"), /*#__PURE__*/React.createElement("p", {
      className: "text-sm text-gray-500 mb-1"
    }, "Build ", APP_BUILD, " van ", new Date(APP_BUILD_DATE).toLocaleDateString('nl-NL')), /*#__PURE__*/React.createElement("p", {
      className: "text-sm text-gray-500 mb-6"
    }, "Verlopen op ", APP_EXPIRY_DATE.toLocaleDateString('nl-NL')), /*#__PURE__*/React.createElement("p", {
      className: "text-sm text-gray-600 mb-4"
    }, "Neem contact op voor een activatiesleutel."), /*#__PURE__*/React.createElement("div", {
      className: "flex gap-2"
    }, /*#__PURE__*/React.createElement("input", {
      type: "text",
      value: activationKey,
      onChange: e => {
        setActivationKey(e.target.value);
        setActivationError(false);
      },
      onKeyDown: e => {
        if (e.key === 'Enter' && activationKey) {
          if (activateApp(activationKey)) {
            setExpired(false);
          } else {
            setActivationError(true);
          }
        }
      },
      placeholder: "Activatiesleutel",
      className: "flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        if (activateApp(activationKey)) {
          setExpired(false);
        } else {
          setActivationError(true);
        }
      },
      className: "px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
    }, "Activeren")), activationError && /*#__PURE__*/React.createElement("p", {
      className: "text-sm text-red-500 mt-2"
    }, "Ongeldige activatiesleutel")));
  }

  // Check URL parameters voor feature flags (?crm&dossierdata)
  var urlParams = new URLSearchParams(window.location.search);
  var crmEnabled = urlParams.has('crm');
  var _useStateDossier = useState(() => {
    try {
      var v = localStorage.getItem('vve_show_dossier');
      return v === null ? true : v === '1';
    } catch (e) {
      return true;
    }
  }),
    _useStateDossier2 = _slicedToArray(_useStateDossier, 2),
    showDossier = _useStateDossier2[0],
    setShowDossier = _useStateDossier2[1];
  // Eén schakelaar voor alle dossier-UI: kolommen, filters en detailpaneel.
  var dossierVisible = showDossier;
  var toggleDossier = function (next) {
    setShowDossier(next);
    try {
      localStorage.setItem('vve_show_dossier', next ? '1' : '0');
    } catch (e) {}
    // Verborgen filters mogen niet stil blijven filteren
    if (!next) {
      setSelectedAdviestraject(new Set());
      setSelectedBureau(new Set());
      setSelectedProcesbegeleider(new Set());
      setSelectedIntake(new Set());
      setSelectedMwa(new Set());
      setSelectedVerdieping(new Set());
      setSelectedUitvoering(new Set());
    }
  };
  var _useState31 = useState(''),
    _useState32 = _slicedToArray(_useState31, 2),
    search = _useState32[0],
    setSearch = _useState32[1];
  var deferredSearch = useDeferredValue(search);
  var _useState33 = useState('vves'),
    _useState34 = _slicedToArray(_useState33, 2),
    activeSheet = _useState34[0],
    setActiveSheet = _useState34[1];
  var _useState35 = useState(null),
    _useState36 = _slicedToArray(_useState35, 2),
    parsedEmail = _useState36[0],
    setParsedEmail = _useState36[1];
  var _useState37 = useState(new Set()),
    _useState38 = _slicedToArray(_useState37, 2),
    selectedGrootte = _useState38[0],
    setSelectedGrootte = _useState38[1];
  var _useState39 = useState(new Set()),
    _useState40 = _slicedToArray(_useState39, 2),
    selectedBouwjaar = _useState40[0],
    setSelectedBouwjaar = _useState40[1];
  var _useState41 = useState(new Set()),
    _useState42 = _slicedToArray(_useState41, 2),
    selectedBuurt = _useState42[0],
    setSelectedBuurt = _useState42[1];
  var _useState43 = useState(new Set()),
    _useState44 = _slicedToArray(_useState43, 2),
    selectedMonument = _useState44[0],
    setSelectedMonument = _useState44[1];
  var _useState45 = useState(new Set()),
    _useState46 = _slicedToArray(_useState45, 2),
    selectedBeschermd = _useState46[0],
    setSelectedBeschermd = _useState46[1];
  var _useState47 = useState(new Set()),
    _useState48 = _slicedToArray(_useState47, 2),
    selectedKvk = _useState48[0],
    setSelectedKvk = _useState48[1];
  var _useState49 = useState(new Set()),
    _useState50 = _slicedToArray(_useState49, 2),
    selectedTijdvak = _useState50[0],
    setSelectedTijdvak = _useState50[1];
  var _useState51 = useState(new Set()),
    _useState52 = _slicedToArray(_useState51, 2),
    selectedWarmte = _useState52[0],
    setSelectedWarmte = _useState52[1];
  var _useState53 = useState(new Set()),
    _useState54 = _slicedToArray(_useState53, 2),
    selectedGemengd = _useState54[0],
    setSelectedGemengd = _useState54[1];
  var _useStateHs = useState(new Set()),
    _useStateHs2 = _slicedToArray(_useStateHs, 2),
    selectedHoofdsplitsing = _useStateHs2[0],
    setSelectedHoofdsplitsing = _useStateHs2[1];
  var _useState55 = useState(new Set()),
    _useState56 = _slicedToArray(_useState55, 2),
    selectedEenheidtype = _useState56[0],
    setSelectedEenheidtype = _useState56[1];
  var _useState57 = useState(new Set()),
    _useState58 = _slicedToArray(_useState57, 2),
    selectedWoz = _useState58[0],
    setSelectedWoz = _useState58[1];
  var _useStateGemLabel = useState(new Set()),
    _useStateGemLabel2 = _slicedToArray(_useStateGemLabel, 2),
    selectedGemLabel = _useStateGemLabel2[0],
    setSelectedGemLabel = _useStateGemLabel2[1];
  var _useStateWozJaar = useState('2025'),
    activeWozJaar = _useStateWozJaar[0],
    setActiveWozJaar = _useStateWozJaar[1];
  var _useState59 = useState(new Set()),
    _useState60 = _slicedToArray(_useState59, 2),
    selectedGespikkeld = _useState60[0],
    setSelectedGespikkeld = _useState60[1];
  var _useState61 = useState(new Set()),
    _useState62 = _slicedToArray(_useState61, 2),
    selectedCorpPct = _useState62[0],
    setSelectedCorpPct = _useState62[1];
  var gespikkeldLookup = typeof GESPIKKELD_DATA !== 'undefined' ? GESPIKKELD_DATA : {};
  var _useStateNieuw = useState(false),
    selectedNieuw = _useStateNieuw[0],
    setSelectedNieuw = _useStateNieuw[1];
  var newVves = typeof NEW_VVES !== 'undefined' ? NEW_VVES : new Set();

  // Dossier filter states (alleen actief met ?dossierdata)
  var _useState63 = useState(new Set()),
    _useState64 = _slicedToArray(_useState63, 2),
    selectedAdviestraject = _useState64[0],
    setSelectedAdviestraject = _useState64[1];
  var _useState65 = useState(new Set()),
    _useState66 = _slicedToArray(_useState65, 2),
    selectedBureau = _useState66[0],
    setSelectedBureau = _useState66[1];
  var _useState67 = useState(new Set()),
    _useState68 = _slicedToArray(_useState67, 2),
    selectedIntake = _useState68[0],
    setSelectedIntake = _useState68[1];
  var _useState69 = useState(new Set()),
    _useState70 = _slicedToArray(_useState69, 2),
    selectedMwa = _useState70[0],
    setSelectedMwa = _useState70[1];
  var _useState71 = useState(new Set()),
    _useState72 = _slicedToArray(_useState71, 2),
    selectedVerdieping = _useState72[0],
    setSelectedVerdieping = _useState72[1];
  var _useState73 = useState(new Set()),
    _useState74 = _slicedToArray(_useState73, 2),
    selectedUitvoering = _useState74[0],
    setSelectedUitvoering = _useState74[1];
  var _useState75 = useState(new Set()),
    _useState76 = _slicedToArray(_useState75, 2),
    selectedProcesbegeleider = _useState76[0],
    setSelectedProcesbegeleider = _useState76[1];

  // Toggle function for multiselect
  var toggleSelection = (setter, value) => {
    setter(prev => {
      var next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
    setDisplayCount(50);
  };
  var _useState77 = useState(null),
    _useState78 = _slicedToArray(_useState77, 2),
    selectedItem = _useState78[0],
    setSelectedItem = _useState78[1];
  var _useState79 = useState(50),
    _useState80 = _slicedToArray(_useState79, 2),
    displayCount = _useState80[0],
    setDisplayCount = _useState80[1];
  var listContainerRef = useRef(null);
  var _useState81 = useState(600),
    _useState82 = _slicedToArray(_useState81, 2),
    listContainerHeight = _useState82[0],
    setListContainerHeight = _useState82[1];
  var sentinelRef = useRef(null);
  var _useState83 = useState(true),
    _useState84 = _slicedToArray(_useState83, 2),
    showVveCounts = _useState84[0],
    setShowVveCounts = _useState84[1]; // true = VvE's, false = adressen
  var _useState85 = useState(new Set()),
    _useState86 = _slicedToArray(_useState85, 2),
    expandedVves = _useState86[0],
    setExpandedVves = _useState86[1]; // Track expanded VvEs
  var _useState87 = useState(false),
    _useState88 = _slicedToArray(_useState87, 2),
    showFilters = _useState88[0],
    setShowFilters = _useState88[1]; // Mobile filter toggle
  var _useState89 = useState(false),
    _useState90 = _slicedToArray(_useState89, 2),
    showDetailPanel = _useState90[0],
    setShowDetailPanel = _useState90[1]; // Mobile detail panel
  var _useState91 = useState('hidden'),
    _useState92 = _slicedToArray(_useState91, 2),
    showDetailPanelDesktop = _useState92[0],
    setShowDetailPanelDesktop = _useState92[1];
  var cycleDetailPanel = function() { setShowDetailPanelDesktop(function(prev) { return prev === 'hidden' ? 'split' : prev === 'split' ? 'full' : 'hidden'; }); };
  var toggleVveExpanded = useCallback(vveId => {
    setExpandedVves(prev => {
      var next = new Set(prev);
      if (next.has(vveId)) {
        next.delete(vveId);
      } else {
        next.add(vveId);
      }
      return next;
    });
  }, []);
  var data = typeof VVE_DATA !== 'undefined' ? VVE_DATA : [];

  // Pre-computed search index: eenmalig bouwen zodat zoeken snel blijft bij 28K records
  var searchIdx = useMemo(() => data.map(item =>
    ((item.statutairenaam || '') + '\0' + (item.postcode || '') + '\0' + (item.buurt || '') + '\0' + formatAddress(item)).toLowerCase()
  ), [data]);

  // Helper to count unique VvEs
  var countUniqueVves = items => {
    return new Set(items.map(i => i.vve_identificatie)).size;
  };

  // Category definitions
  var grootteCategories = [{
    key: 'mini',
    label: 'Mini (1-2)',
    min: 0,
    max: 2
  }, {
    key: 'klein',
    label: 'Klein (3-7)',
    min: 3,
    max: 7
  }, {
    key: 'groot',
    label: 'Groot (8+)',
    min: 8,
    max: Infinity
  }];
  var bouwjaarCategories = [{
    key: 'voor1925',
    label: 'Voor 1925',
    min: 0,
    max: 1924,
    desc: 'Geen spouw, geen isolatie, houten vloeren'
  }, {
    key: '1925-1944',
    label: '1925-1945',
    min: 1925,
    max: 1944,
    desc: 'Vaak wel spouw, geen isolatie, houten vloeren'
  }, {
    key: '1945-1974',
    label: '1945-1975',
    min: 1945,
    max: 1974,
    desc: 'Spouw, nauwelijks isolatie, betonnen vloeren'
  }, {
    key: '1975-1986',
    label: '1975-1987',
    min: 1975,
    max: 1986,
    desc: 'Eerste isolatie-eisen, deels dubbelglas'
  }, {
    key: '1987-1991',
    label: '1987-1992',
    min: 1987,
    max: 1991,
    desc: 'Redelijke isolatie'
  }, {
    key: '1992-1999',
    label: '1992-2000',
    min: 1992,
    max: 1999,
    desc: 'Hogere isolatienormen'
  }, {
    key: '2000-2013',
    label: '2000-2014',
    min: 2000,
    max: 2013,
    desc: 'Goede isolatie'
  }, {
    key: '2014-2021',
    label: '2014-2021',
    min: 2014,
    max: 2021,
    desc: 'Zeer goede isolatie'
  }, {
    key: 'na2021',
    label: 'Na 2021',
    min: 2022,
    max: 9999,
    desc: 'BENG, zeer hoge isolatie'
  }];
  var monumentCategories = [{
    key: 'rijksmonument',
    label: 'Rijksmonument'
  }, {
    key: 'gemeentelijk',
    label: 'Gemeentelijk monument'
  }, {
    key: 'orde2',
    label: 'Orde 2'
  }, {
    key: 'geen',
    label: 'Geen monument'
  }];
  var beschermdCategories = [{
    key: 'ja',
    label: 'Beschermd stadsgezicht'
  }, {
    key: 'nee',
    label: 'Niet beschermd'
  }];
  var tijdvakCategories = [{
    key: 'tussen nu en 2027',
    label: 'Tussen nu en 2027'
  }, {
    key: 'tussen 2028 en 2030',
    label: 'Tussen 2028 en 2030'
  }, {
    key: 'tussen 2030 en 2035',
    label: 'Tussen 2030 en 2035'
  }, {
    key: 'na 2034',
    label: 'Na 2034'
  }, {
    key: 'nvt',
    label: 'Nvt'
  }, {
    key: 'onbekend',
    label: 'Onbekend'
  }];
  var warmteCategories = [{
    key: 'MT',
    label: 'MT (midden temperatuur)'
  }, {
    key: 'ZLT',
    label: 'ZLT (zeer lage temperatuur)'
  }, {
    key: 'Individueel',
    label: 'Individueel'
  }, {
    key: 'Onderzoek',
    label: 'Onderzoek'
  }, {
    key: 'nvt',
    label: 'Nvt'
  }, {
    key: 'onbekend',
    label: 'Onbekend'
  }];
  var getTijdvakKey = item => {
    var w = getWarmteProg(item);
    return w ? w.tijdvak : 'onbekend';
  };
  var getWarmteKey = item => {
    var w = getWarmteProg(item);
    return w ? w.warmte : 'onbekend';
  };
  // Categorieen die in de hele dataset niet voorkomen (bv. 'nvt', 'onbekend')
  // tonen we niet als altijd-lege filteroptie.
  var _warmteAanwezig = useMemo(() => {
    var t = new Set(),
      w = new Set();
    data.forEach(item => {
      var p = getWarmteProg(item);
      t.add(p ? p.tijdvak : 'onbekend');
      w.add(p ? p.warmte : 'onbekend');
    });
    return {
      tijdvak: t,
      warmte: w
    };
  }, [data]);
  tijdvakCategories = tijdvakCategories.filter(c => _warmteAanwezig.tijdvak.has(c.key));
  warmteCategories = warmteCategories.filter(c => _warmteAanwezig.warmte.has(c.key));
  var getMonumentKey = status => {
    if (!status) return 'geen';
    var s = status.toLowerCase();
    if (s.includes('rijksmonument')) return 'rijksmonument';
    if (s.includes('gemeentelijk')) return 'gemeentelijk';
    if (s.includes('orde 2')) return 'orde2';
    return 'geen';
  };
  var getBeschermdKey = vveId => getBeschermdGezicht(vveId) ? 'ja' : 'nee';

  // Gespikkeld categories
  var gespikkeldCategories = [{
    key: 'ja',
    label: 'Gespikkeld (deels corporatie)'
  }, {
    key: 'corporatie',
    label: 'Volledig corporatiebezit (100%)'
  }, {
    key: 'nee',
    label: 'Geen corporatiewoningen'
  }];
  var getGespikkeldKey = vveId => {
    var entry = gespikkeldLookup[vveId];
    if (!entry) return 'nee';
    if (entry.gespikkeld) return 'ja';
    return entry.pct_corporatie >= 100 ? 'corporatie' : 'nee';
  };

  // Corporatie-% categories
  var corpPctCategories = [{
    key: 'geen',
    label: 'Geen corporatiewoningen (0%)',
    min: 0,
    max: 0
  }, {
    key: 'laag',
    label: '1 – 25%',
    min: 1,
    max: 25
  }, {
    key: 'matig',
    label: '26 – 50%',
    min: 26,
    max: 50
  }, {
    key: 'hoog',
    label: '51 – 99%',
    min: 51,
    max: 99
  }, {
    key: 'vol',
    label: 'Volledig corporatie (100%)',
    min: 100,
    max: 100
  }];
  var getCorpPctKey = vveId => {
    var entry = gespikkeldLookup[vveId];
    var pct = entry ? entry.pct_corporatie : 0;
    if (pct === 0) return 'geen';
    if (pct <= 25) return 'laag';
    if (pct <= 50) return 'matig';
    if (pct < 100) return 'hoog';
    return 'vol';
  };
  var _useState93 = useState(Object.keys(loadEnrichmentData()).length),
    _useState94 = _slicedToArray(_useState93, 2),
    enrichmentCount = _useState94[0],
    setEnrichmentCount = _useState94[1];
  // Base filtered data (search applied - or all data if no search)
  // Note: VvE's with 0 woningen are already filtered out in vve_data.js
  var searchFilteredData = useMemo(() => {
    var t0 = performance.now();
    if (deferredSearch.length < 2) {
      console.log(`[perf] searchFilteredData: geen filter → ${data.length} records`);
      return data;
    }
    var searchLower = deferredSearch.toLowerCase();
    var localEnrichData = loadEnrichmentData();
    var dossierData = typeof VVE_DOSSIER_DATA !== 'undefined' ? VVE_DOSSIER_DATA : {};
    var result = data.filter((item, i) => {
      // Snelle check via pre-computed index (naam + postcode + buurt + adres in één string)
      if (searchIdx[i] && searchIdx[i].includes(searchLower)) return true;
      // Nickname als fallback (alleen bereikt als niets in de index matcht)
      var localEntry = localEnrichData[item.vve_identificatie] || {};
      var fileEntry = dossierData[item.vve_identificatie] || {};
      var nickname = (localEntry.nickname || fileEntry.nickname || '').toLowerCase();
      return nickname.includes(searchLower);
    });
    console.log(`[perf] searchFilteredData: ${(performance.now() - t0).toFixed(1)}ms → ${result.length} records (query="${deferredSearch}")`);
    return result;
  }, [data, searchIdx, deferredSearch, enrichmentCount]);

  // KvK categories
  var kvkCategories = [{
    key: 'eigen',
    label: 'KvK eigen dataset',
    color: 'text-green-600'
  }, {
    key: 'lookup',
    label: 'KvK alternatieve lijst',
    color: 'text-orange-500'
  }, {
    key: 'handmatig',
    label: 'KvK handmatig',
    color: 'text-red-500'
  }, {
    key: 'zonder_kvk',
    label: 'Zonder KvK-nummer'
  }];
  var getKvkKey = item => {
    if (item.kvknummer) return 'eigen';
    if (lookupKvkNummer(item.vve_identificatie)) return 'lookup';
    if (getVveEnrichment(item.vve_identificatie)?.kvkNummer) return 'handmatig';
    return 'zonder_kvk';
  };
  var getActiveWoz = item => item['woz' + activeWozJaar] || null;
  var wozCategories = [{
    key: 'onder',
    label: `WOZ ${activeWozJaar} \u2264 \u20AC596k`
  }, {
    key: 'boven',
    label: `WOZ ${activeWozJaar} > \u20AC596k`
  }];
  var getWozKey = woz => !woz || woz <= 596000 ? 'onder' : 'boven';

  // Gemengd categories (VvE met zowel woon- als bedrijfsruimtes, excl. garages)
  var gemengdCategories = [{
    key: 'ja',
    label: 'Ja (wonen + bedrijf)'
  }, {
    key: 'nee',
    label: 'Nee (alleen wonen)'
  }];
  var isGemengd = item => {
    return (item.aantal_niet_woon_adr_in_vve || 0) > 0 && (item.aantal_woon_adr_in_vve || 0) > 0;
  };
  var hoofdsplitsingCategories = [{
    key: 'ja',
    label: 'Hoofdsplitsing'
  }, {
    key: 'nee',
    label: 'Gewone VvE'
  }];

  // Eenheidtype categories
  var eenheidtypeCategories = [{
    key: 'appartement',
    label: 'Appartement'
  }, {
    key: 'boven_beneden',
    label: 'Boven/beneden'
  }, {
    key: 'eengezins',
    label: 'Eengezins'
  }, {
    key: 'overig_woning',
    label: 'Overige woning'
  }, {
    key: 'garage',
    label: 'Garage/berging'
  }, {
    key: 'overig',
    label: 'Overig/onbekend'
  }];
  var getEenheidtypeKey = type => {
    if (!type) return 'overig';
    var t = type.toLowerCase();
    if (t.includes('appartement')) return 'appartement';
    if (t.includes('boven') || t.includes('beneden')) return 'boven_beneden';
    if (t.includes('tussen') || t.includes('hoek') || t.includes('2 ^ 1 kap') || t.includes('vrijstaand') || t.includes('aanleun')) return 'eengezins';
    if (t.includes('garage') || t.includes('berging') || t.includes('opslag')) return 'garage';
    if (t.includes('woning') || t.includes('wooneenheid')) return 'overig_woning';
    return 'overig';
  };

  // Precompute dossier velden per VvE (bestandsdata + localStorage); herbereken bij save
  var dossierByVve = useMemo(() => {
    var map = {};
    var seen = new Set();
    data.forEach(item => {
      if (seen.has(item.vve_identificatie)) return;
      seen.add(item.vve_identificatie);
      var enr = getVveEnrichment(item.vve_identificatie);
      if (enr) map[item.vve_identificatie] = enr;
    });
    return map;
  }, [data, enrichmentCount]);

  // Pre-compute KvK-key per VvE eenmalig (4412 unieke VvE's, niet 27k records × 4 categorieën)
  var kvkKeyByVve = useMemo(() => {
    var map = {};
    var seen = new Set();
    data.forEach(item => {
      if (seen.has(item.vve_identificatie)) return;
      seen.add(item.vve_identificatie);
      map[item.vve_identificatie] = getKvkKey(item);
    });
    return map;
  }, [data]); // data verandert niet — dit wordt dus eenmalig berekend

  var avgLabelByVve = useMemo(() => {
    var groups = {};
    data.forEach(item => {
      var id = item.vve_identificatie;
      if (!id) return;
      if (!groups[id]) groups[id] = [];
      groups[id].push(item);
    });
    var map = {};
    Object.entries(groups).forEach(function(_ref) {
      var id = _ref[0], addrs = _ref[1];
      map[id] = getAverageEnergyLabel(addrs);
    });
    return map;
  }, [data]);

  // === Cross-filter system ===
  // All filters defined as named predicates
  var filterDefs = useMemo(() => ({
    kvk: {
      active: selectedKvk.size > 0,
      fn: item => selectedKvk.has(kvkKeyByVve[item.vve_identificatie] || 'zonder_kvk')
    },
    grootte: {
      active: selectedGrootte.size > 0,
      fn: item => [...selectedGrootte].some(key => {
        var cat = grootteCategories.find(c => c.key === key);
        return cat && item.aantal_woon_adr_in_vve >= cat.min && item.aantal_woon_adr_in_vve <= cat.max;
      })
    },
    gemengd: {
      active: selectedGemengd.size > 0,
      fn: item => {
        var key = isGemengd(item) ? 'ja' : 'nee';
        return selectedGemengd.has(key);
      }
    },
    hoofdsplitsing: {
      active: selectedHoofdsplitsing.size > 0,
      fn: item => selectedHoofdsplitsing.has(isHoofdsplitsing(item) ? 'ja' : 'nee')
    },
    eenheidtype: {
      active: selectedEenheidtype.size > 0,
      fn: item => selectedEenheidtype.has(getEenheidtypeKey(item.basiseenheidtype))
    },
    bouwjaar: {
      active: selectedBouwjaar.size > 0,
      fn: item => {
        var jaar = parseInt(item.bouwjaar_gerelateerd_pand) || 0;
        return [...selectedBouwjaar].some(key => {
          var cat = bouwjaarCategories.find(c => c.key === key);
          return cat && jaar >= cat.min && jaar <= cat.max;
        });
      }
    },
    buurt: {
      active: selectedBuurt.size > 0,
      fn: item => selectedBuurt.has(item.buurt)
    },
    tijdvak: {
      active: selectedTijdvak.size > 0,
      fn: item => selectedTijdvak.has(getTijdvakKey(item))
    },
    warmte: {
      active: selectedWarmte.size > 0,
      fn: item => selectedWarmte.has(getWarmteKey(item))
    },
    monument: {
      active: selectedMonument.size > 0,
      fn: item => selectedMonument.has(getMonumentKey(item.monumentale_status))
    },
    beschermd: {
      active: selectedBeschermd.size > 0,
      fn: item => selectedBeschermd.has(getBeschermdKey(item.vve_identificatie))
    },
    woz: {
      active: selectedWoz.size > 0,
      fn: item => selectedWoz.has(getWozKey(getActiveWoz(item)))
    },
    gespikkeld: {
      active: selectedGespikkeld.size > 0,
      fn: item => selectedGespikkeld.has(getGespikkeldKey(item.vve_identificatie))
    },
    corp_pct: {
      active: selectedCorpPct.size > 0,
      fn: item => selectedCorpPct.has(getCorpPctKey(item.vve_identificatie))
    },
    adviestraject: {
      active: selectedAdviestraject.size > 0,
      fn: item => selectedAdviestraject.has(dossierByVve[item.vve_identificatie]?.adviestraject || '')
    },
    bureau: {
      active: selectedBureau.size > 0,
      fn: item => selectedBureau.has(dossierByVve[item.vve_identificatie]?.bureau || '')
    },
    intake: {
      active: selectedIntake.size > 0,
      fn: item => selectedIntake.has(dossierByVve[item.vve_identificatie]?.intake || '')
    },
    mwa: {
      active: selectedMwa.size > 0,
      fn: item => selectedMwa.has(dossierByVve[item.vve_identificatie]?.mwa || '')
    },
    verdieping: {
      active: selectedVerdieping.size > 0,
      fn: item => selectedVerdieping.has(dossierByVve[item.vve_identificatie]?.verdieping || '')
    },
    uitvoering: {
      active: selectedUitvoering.size > 0,
      fn: item => selectedUitvoering.has(dossierByVve[item.vve_identificatie]?.uitvoering || '')
    },
    procesbegeleider: {
      active: selectedProcesbegeleider.size > 0,
      fn: item => selectedProcesbegeleider.has(dossierByVve[item.vve_identificatie]?.procesbegeleider || '')
    },
    nieuw: {
      active: selectedNieuw,
      fn: item => newVves.has(item.vve_identificatie)
    },
    gemLabel: {
      active: selectedGemLabel.size > 0,
      fn: item => selectedGemLabel.has(avgLabelByVve[item.vve_identificatie] || '')
    }
  }), [selectedKvk, kvkKeyByVve, selectedGrootte, selectedGemengd, selectedHoofdsplitsing, selectedEenheidtype, selectedBouwjaar, selectedBuurt, selectedTijdvak, selectedWarmte, selectedMonument, selectedBeschermd, selectedWoz, selectedGespikkeld, selectedCorpPct, selectedAdviestraject, selectedBureau, selectedIntake, selectedMwa, selectedVerdieping, selectedUitvoering, selectedProcesbegeleider, dossierByVve, selectedNieuw, newVves, selectedGemLabel, avgLabelByVve]);

  // Apply all filters except the excluded one(s)
  var applyFiltersExcept = useCallback((baseData, excludeKey) => {
    // Hoist active-filter list outside the per-item loop (was: Object.entries per item)
    var active = Object.entries(filterDefs).filter(([k, d]) => k !== excludeKey && d.active);
    if (active.length === 0) return baseData; // fast path: no filters active
    return baseData.filter(item => {
      for (var _ref3 of active) {
        var _ref2 = _slicedToArray(_ref3, 2);
        var def = _ref2[1];
        if (!def.fn(item)) return false;
      }
      return true;
    });
  }, [filterDefs]);

  // Fully filtered data (all filters applied)
  var fullyFilteredData = useMemo(() => {
    var t0 = performance.now();
    var r = applyFiltersExcept(searchFilteredData, null);
    console.log(`[perf] fullyFilteredData: ${(performance.now() - t0).toFixed(1)}ms → ${r.length} records`);
    return r;
  }, [searchFilteredData, applyFiltersExcept]);

  // Cross-filtered facet counts: each facet counts against all OTHER filters
  var kvkFacetCounts = useMemo(() => {
    var t0 = performance.now();
    var base = applyFiltersExcept(searchFilteredData, 'kvk');
    // Gebruik pre-computed kvkKeyByVve (O(1) per item ipv string-normalisatie)
    var counts = {
      addresses: {},
      vves: {}
    };
    var addrCounts = {};
    var vveSets = {};
    kvkCategories.forEach(cat => {
      addrCounts[cat.key] = 0;
      vveSets[cat.key] = new Set();
    });
    base.forEach(item => {
      var key = kvkKeyByVve[item.vve_identificatie] || 'zonder_kvk';
      addrCounts[key] = (addrCounts[key] || 0) + 1;
      if (vveSets[key]) vveSets[key].add(item.vve_identificatie);
    });
    kvkCategories.forEach(cat => {
      counts.addresses[cat.key] = addrCounts[cat.key] || 0;
      counts.vves[cat.key] = vveSets[cat.key]?.size || 0;
    });
    console.log(`[perf] kvkFacetCounts: ${(performance.now() - t0).toFixed(1)}ms (base=${base.length})`);
    return counts;
  }, [searchFilteredData, applyFiltersExcept, kvkKeyByVve]);
  var grootteFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'grootte');
    var counts = {
      addresses: {},
      vves: {}
    };
    grootteCategories.forEach(cat => {
      var filtered = base.filter(item => item.aantal_woon_adr_in_vve >= cat.min && item.aantal_woon_adr_in_vve <= cat.max);
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var gemengdFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'gemengd');
    var counts = {
      addresses: {},
      vves: {}
    };
    gemengdCategories.forEach(cat => {
      var filtered = base.filter(item => {
        var g = isGemengd(item);
        return cat.key === 'ja' ? g : !g;
      });
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var hoofdsplitsingFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'hoofdsplitsing');
    var counts = {
      addresses: {},
      vves: {}
    };
    hoofdsplitsingCategories.forEach(cat => {
      var filtered = base.filter(item => isHoofdsplitsing(item) === (cat.key === 'ja'));
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var eenheidtypeFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'eenheidtype');
    var counts = {
      addresses: {},
      vves: {}
    };
    eenheidtypeCategories.forEach(cat => {
      var filtered = base.filter(item => getEenheidtypeKey(item.basiseenheidtype) === cat.key);
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var bouwjaarFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'bouwjaar');
    var counts = {
      addresses: {},
      vves: {}
    };
    bouwjaarCategories.forEach(cat => {
      var filtered = base.filter(item => {
        var jaar = parseInt(item.bouwjaar_gerelateerd_pand) || 0;
        return jaar >= cat.min && jaar <= cat.max;
      });
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var buurtFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'buurt');
    var addressCounts = {};
    var vveCounts = {};
    base.forEach(item => {
      addressCounts[item.buurt] = (addressCounts[item.buurt] || 0) + 1;
      if (!vveCounts[item.buurt]) vveCounts[item.buurt] = new Set();
      vveCounts[item.buurt].add(item.vve_identificatie);
    });
    var entries = Object.keys(addressCounts).map(buurt => ({
      buurt,
      addresses: addressCounts[buurt],
      vves: vveCounts[buurt].size
    }));
    return entries.sort((a, b) => a.buurt.localeCompare(b.buurt));
  }, [searchFilteredData, applyFiltersExcept]);
  var tijdvakFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'tijdvak');
    var counts = {
      addresses: {},
      vves: {}
    };
    tijdvakCategories.forEach(cat => {
      var filtered = base.filter(item => getTijdvakKey(item) === cat.key);
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var warmteFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'warmte');
    var counts = {
      addresses: {},
      vves: {}
    };
    warmteCategories.forEach(cat => {
      var filtered = base.filter(item => getWarmteKey(item) === cat.key);
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var monumentFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'monument');
    var counts = {
      addresses: {},
      vves: {}
    };
    monumentCategories.forEach(cat => {
      var filtered = base.filter(item => getMonumentKey(item.monumentale_status) === cat.key);
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var beschermdFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'beschermd');
    var counts = {
      addresses: {},
      vves: {}
    };
    beschermdCategories.forEach(cat => {
      var filtered = base.filter(item => getBeschermdKey(item.vve_identificatie) === cat.key);
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var wozFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'woz');
    var counts = {
      addresses: {},
      vves: {}
    };
    wozCategories.forEach(cat => {
      var filtered = base.filter(item => getWozKey(getActiveWoz(item)) === cat.key);
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var LABEL_ORDER_FILTER = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
  var gemLabelFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'gemLabel');
    var counts = { addresses: {}, vves: {} };
    LABEL_ORDER_FILTER.forEach(function(label) {
      var filtered = base.filter(function(item) { return (avgLabelByVve[item.vve_identificatie] || '') === label; });
      counts.addresses[label] = filtered.length;
      counts.vves[label] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept, avgLabelByVve]);

  var gespikkeldFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'gespikkeld');
    var counts = {
      addresses: {},
      vves: {}
    };
    gespikkeldCategories.forEach(cat => {
      var filtered = base.filter(item => getGespikkeldKey(item.vve_identificatie) === cat.key);
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var nieuwFacetCount = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'nieuw');
    var filtered = base.filter(item => newVves.has(item.vve_identificatie));
    return { addresses: filtered.length, vves: countUniqueVves(filtered) };
  }, [searchFilteredData, applyFiltersExcept, newVves]);
  var corpPctFacetCounts = useMemo(() => {
    var base = applyFiltersExcept(searchFilteredData, 'corp_pct');
    var counts = {
      addresses: {},
      vves: {}
    };
    corpPctCategories.forEach(cat => {
      var filtered = base.filter(item => getCorpPctKey(item.vve_identificatie) === cat.key);
      counts.addresses[cat.key] = filtered.length;
      counts.vves[cat.key] = countUniqueVves(filtered);
    });
    return counts;
  }, [searchFilteredData, applyFiltersExcept]);
  var dossierFacetCounts = useMemo(() => {
    var fields = {
      adviestraject: ADVIESTRAJECT_OPTIES,
      bureau: BUREAU_OPTIES,
      intake: INTAKE_OPTIES,
      mwa: FASE_OPTIES,
      verdieping: FASE_OPTIES,
      uitvoering: FASE_OPTIES,
      procesbegeleider: PROCESBEGELEIDER_OPTIES
    };
    var result = {};
    Object.entries(fields).forEach(([field, opties]) => {
      var base = applyFiltersExcept(searchFilteredData, field);
      var counts = {
        addresses: {},
        vves: {}
      };
      opties.forEach(opt => {
        var filtered = base.filter(item => (dossierByVve[item.vve_identificatie]?.[field] || '') === opt);
        counts.addresses[opt] = filtered.length;
        counts.vves[opt] = countUniqueVves(filtered);
      });
      result[field] = counts;
    });
    return result;
  }, [searchFilteredData, applyFiltersExcept, dossierByVve]);

  // Helper: sum facet counts for "Alle" row
  var sumFacet = fc => ({
    addresses: Object.values(fc.addresses).reduce((a, b) => a + b, 0),
    vves: Object.values(fc.vves).reduce((a, b) => a + b, 0)
  });

  // Group by VvE
  var groupedByVve = useMemo(() => {
    var t0 = performance.now();
    var groups = {};
    fullyFilteredData.forEach(item => {
      var vveId = item.vve_identificatie;
      if (!vveId) return;
      if (!groups[vveId]) {
        groups[vveId] = {
          vve: item,
          // Use first item as VvE reference
          addresses: []
        };
      }
      groups[vveId].addresses.push(item);
    });
    // Sort by number of matching addresses (descending), then by name
    var r = Object.values(groups).sort((a, b) => {
      if (b.addresses.length !== a.addresses.length) {
        return b.addresses.length - a.addresses.length;
      }
      return (a.vve.statutairenaam || '').localeCompare(b.vve.statutairenaam || '');
    });
    console.log(`[perf] groupedByVve: ${(performance.now() - t0).toFixed(1)}ms → ${r.length} groups`);
    return r;
  }, [fullyFilteredData]);
  var totalVveCount = groupedByVve.length;
  var totalAddressCount = fullyFilteredData.length;
  // Totaal woningen = som van aantal_woon_adr_in_vve per unieke VvE
  var totalWoningenCount = useMemo(() => {
    return groupedByVve.reduce((sum, group) => sum + (group.vve.aantal_woon_adr_in_vve || 0), 0);
  }, [groupedByVve]);
  // Infinite scroll: slice groupedByVve to displayCount
  var displayedVveGroups = useMemo(() => groupedByVve.slice(0, displayCount), [groupedByVve, displayCount]);

  // Reset displayCount to 50 when the filtered list changes
  useEffect(() => {
    setDisplayCount(50);
  }, [groupedByVve]);

  // Track container height for phantom rows
  useEffect(() => {
    var el = listContainerRef.current;
    if (!el) return;
    var ro = new ResizeObserver(([e]) => setListContainerHeight(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // IntersectionObserver: load more when sentinel enters view
  useEffect(() => {
    var sentinel = sentinelRef.current;
    if (!sentinel) return;
    var io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && displayCount < groupedByVve.length) {
        setDisplayCount(prev => Math.min(prev + 50, groupedByVve.length));
      }
    }, {
      rootMargin: '200px'
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [displayCount, groupedByVve.length]);
  var vveAddresses = useMemo(() => {
    if (!selectedItem) return [];
    return data.filter(item => item.vve_identificatie === selectedItem.vve_identificatie);
  }, [data, selectedItem]);
  var totalVves = useMemo(() => {
    var vves = new Set(data.map(item => item.vve_identificatie));
    return vves.size;
  }, [data]);
  var handleSearch = useCallback(value => {
    setSearch(value);
    setParsedEmail(null);
    setDisplayCount(50);
  }, []);
  var handleParsedEmail = useCallback(parsed => {
    setParsedEmail(parsed);
    var searchTerm = parsed.adres || parsed.vveNaam || '';
    setSearch(searchTerm);
    clearAllFilters();
  }, []);
  var clearParsedEmail = useCallback(() => {
    setParsedEmail(null);
    setSearch('');
    clearAllFilters();
  }, []);
  var clearAllFilters = () => {
    setSelectedGrootte(new Set());
    setSelectedBouwjaar(new Set());
    setSelectedBuurt(new Set());
    setSelectedMonument(new Set());
    setSelectedBeschermd(new Set());
    setSelectedTijdvak(new Set());
    setSelectedWarmte(new Set());
    setSelectedGemengd(new Set());
    setSelectedHoofdsplitsing(new Set());
    setSelectedEenheidtype(new Set());
    setSelectedKvk(new Set());
    setSelectedWoz(new Set());
    setSelectedGespikkeld(new Set());
    setSelectedCorpPct(new Set());
    setSelectedNieuw(false);
    setSelectedGemLabel(new Set());
    setDisplayCount(50);
  };

  // Handle item selection
  var handleSelectItem = useCallback(item => {
    setSelectedItem(item);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    var handleKeyDown = e => {
      // Alleen als we niet in een input veld zitten
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Escape: sluit detailpaneel direct (ook vanuit fullscreen)
      if (e.key === 'Escape' && showDetailPanelDesktop !== 'hidden') {
        e.preventDefault();
        setShowDetailPanelDesktop('hidden');
        return;
      }

      // Spatie: toon/verberg detailpaneel als een VvE geselecteerd is
      if (e.key === ' ' && selectedItem) {
        e.preventDefault();
        cycleDetailPanel();
        return;
      }

      // Pijl links/rechts: in-/uitklappen van de geselecteerde VvE-rij
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!selectedItem) return;
        e.preventDefault();
        var vveId = selectedItem.vve_identificatie;
        if (e.key === 'ArrowRight') {
          setExpandedVves(prev => new Set([...prev, vveId]));
        } else {
          setExpandedVves(prev => {
            var n = new Set(prev);
            n.delete(vveId);
            return n;
          });
        }
        return;
      }

      // Pijl omhoog/omlaag: navigatie door de lijst
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();

        // Bouw een platte lijst van alle navigeerbare items
        // Voor ingeklapte VvEs: alleen eerste adres
        // Voor uitgeklapte VvEs: alle adressen
        var navigationList = [];
        displayedVveGroups.forEach(group => {
          var sorted = [...group.addresses].sort((a, b) => {
            var numA = parseInt(a.huisnummer) || 0;
            var numB = parseInt(b.huisnummer) || 0;
            if (numA !== numB) return numA - numB;
            return (a.huislettertoevoeging || '').localeCompare(b.huislettertoevoeging || '');
          });
          if (expandedVves.has(group.vve.vve_identificatie)) {
            // VvE is uitgeklapt: voeg alle adressen toe
            sorted.forEach(addr => navigationList.push(addr));
          } else {
            // VvE is ingeklapt: alleen eerste adres
            if (sorted[0]) navigationList.push(sorted[0]);
          }
        });
        if (navigationList.length === 0) return;

        // Vind huidige index
        var currentIndex = -1;
        if (selectedItem) {
          currentIndex = navigationList.findIndex(addr => addr.id === selectedItem.id);
        }
        var newIndex;
        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < navigationList.length - 1 ? currentIndex + 1 : 0;
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : navigationList.length - 1;
        }
        var newItem = navigationList[newIndex];
        handleSelectItem(newItem);

        // Als we naar een adres in een ingeklapte VvE navigeren, klap deze uit
        if (!expandedVves.has(newItem.vve_identificatie)) {
          setExpandedVves(prev => new Set([...prev, newItem.vve_identificatie]));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayedVveGroups, selectedItem, expandedVves, handleSelectItem, showDetailPanelDesktop]);

  useEffect(() => {
    var handler = function(e) {
      var item = e.detail;
      if (!item || !item.vve_identificatie) return;
      setActiveSheet('vves');
      setSearch(item.statutairenaam || '');
      setDisplayCount(50);
      setSelectedItem(item);
    };
    window.addEventListener('vve-navigate', handler);
    return function() { window.removeEventListener('vve-navigate', handler); };
  }, []);

  useEffect(() => {
    var handler = function(e) {
      if (e.data && e.data.source === 'adresverkenner' && e.data.action === 'close') {
        setShowDetailPanelDesktop('hidden');
      }
    };
    window.addEventListener('message', handler);
    return function() { window.removeEventListener('message', handler); };
  }, []);

  var hasActiveFilters = selectedGrootte.size > 0 || selectedBouwjaar.size > 0 || selectedBuurt.size > 0 || selectedMonument.size > 0 || selectedBeschermd.size > 0 || selectedTijdvak.size > 0 || selectedWarmte.size > 0 || selectedGemengd.size > 0 || selectedHoofdsplitsing.size > 0 || selectedEenheidtype.size > 0 || selectedKvk.size > 0 || selectedWoz.size > 0 || selectedGespikkeld.size > 0 || selectedCorpPct.size > 0 || selectedAdviestraject.size > 0 || selectedBureau.size > 0 || selectedIntake.size > 0 || selectedMwa.size > 0 || selectedVerdieping.size > 0 || selectedUitvoering.size > 0 || selectedProcesbegeleider.size > 0 || selectedNieuw || selectedGemLabel.size > 0;

  // Multi-user enrichment state
  var _useState95 = useState(() => localStorage.getItem('vve_dashboard_username') || ''),
    _useState96 = _slicedToArray(_useState95, 2),
    currentUser = _useState96[0],
    setCurrentUser = _useState96[1];
  var _useState97 = useState(() => !localStorage.getItem('vve_dashboard_username')),
    _useState98 = _slicedToArray(_useState97, 2),
    showUsernameDialog = _useState98[0],
    setShowUsernameDialog = _useState98[1];
  var _useState99 = useState(false),
    _useState100 = _slicedToArray(_useState99, 2),
    enrichmentDirty = _useState100[0],
    setEnrichmentDirty = _useState100[1];
  var _useState101 = useState(false),
    _useState102 = _slicedToArray(_useState101, 2),
    showChangeLog = _useState102[0],
    setShowChangeLog = _useState102[1];
  var _useState103 = useState('idle'),
    _useState104 = _slicedToArray(_useState103, 2),
    enrichmentSaveStatus = _useState104[0],
    setEnrichmentSaveStatus = _useState104[1]; // idle | saving | ok | error
  var _useState105 = useState([]),
    _useState106 = _slicedToArray(_useState105, 2),
    loadedUsers = _useState106[0],
    setLoadedUsers = _useState106[1]; // usernames van geladen enrichment files

  // Luister naar enrichmentDirty events van setVveEnrichment
  useEffect(() => {
    var handler = () => setEnrichmentDirty(true);
    window.addEventListener('enrichmentDirty', handler);
    return () => window.removeEventListener('enrichmentDirty', handler);
  }, []);

  // Waarschuw bij sluiten met onopgeslagen wijzigingen
  useEffect(() => {
    var handler = e => {
      if (!enrichmentDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enrichmentDirty]);

  // CSV Export state
  var _useState107 = useState(false),
    _useState108 = _slicedToArray(_useState107, 2),
    showCsvMenu = _useState108[0],
    setShowCsvMenu = _useState108[1];
  var _useState109 = useState(false),
    _useState110 = _slicedToArray(_useState109, 2),
    xlsxLoading = _useState110[0],
    setXlsxLoading = _useState110[1];
  var _useState111 = useState(false),
    _useState112 = _slicedToArray(_useState111, 2),
    xlsxAdressenLoading = _useState112[0],
    setXlsxAdressenLoading = _useState112[1];
  var _useState113 = useState(false),
    _useState114 = _slicedToArray(_useState113, 2),
    xlsxImportLoading = _useState114[0],
    setXlsxImportLoading = _useState114[1];
  var _useState115 = useState(false),
    _useState116 = _slicedToArray(_useState115, 2),
    showDataMenu = _useState116[0],
    setShowDataMenu = _useState116[1];
  var _useState117 = useState(false),
    _useState118 = _slicedToArray(_useState117, 2),
    showCrmMenu = _useState118[0],
    setShowCrmMenu = _useState118[1];
  var _useState119 = useState(false),
    _useState120 = _slicedToArray(_useState119, 2),
    showUserMenu = _useState120[0],
    setShowUserMenu = _useState120[1];
  var _useStateHelp = useState(false),
    _useStateHelp2 = _slicedToArray(_useStateHelp, 2),
    showHelp = _useStateHelp2[0],
    setShowHelp = _useStateHelp2[1];

  // Dossier sync state (File System Access API)
  var _useState121 = useState('idle'),
    _useState122 = _slicedToArray(_useState121, 2),
    dossierSyncStatus = _useState122[0],
    setDossierSyncStatus = _useState122[1]; // idle | syncing | ok | error
  var _useState123 = useState(null),
    _useState124 = _slicedToArray(_useState123, 2),
    dossierLastSync = _useState124[0],
    setDossierLastSync = _useState124[1];
  var _useState125 = useState(false),
    _useState126 = _slicedToArray(_useState125, 2),
    dossierDirLinked = _useState126[0],
    setDossierDirLinked = _useState126[1];
  var _useState127 = useState(false),
    _useState128 = _slicedToArray(_useState127, 2),
    fsApiBlocked = _useState128[0],
    setFsApiBlocked = _useState128[1]; // true als IT-policy showDirectoryPicker blokkeert
  var _useState129 = useState(false),
    _useState130 = _slicedToArray(_useState129, 2),
    crmConnected = _useState130[0],
    setCrmConnected = _useState130[1];
  var _useState131 = useState(''),
    _useState132 = _slicedToArray(_useState131, 2),
    crmFileName = _useState132[0],
    setCrmFileName = _useState132[1];
  var _useState133 = useState(0),
    _useState134 = _slicedToArray(_useState133, 2),
    crmVveCount = _useState134[0],
    setCrmVveCount = _useState134[1];
  var fileInputRef = useRef(null);
  var xlsxInputRef = useRef(null);

  // CRM functies
  var handleConnectCrm = async () => {
    var success = await selectCrmFile();
    if (success) {
      setCrmConnected(true);
      setCrmFileName(crmFileHandle.name);
      setCrmVveCount(Object.keys(crmData.vves).length);
    }
    setShowCrmMenu(false);
  };
  var handleNewCrmFile = async () => {
    var success = await createNewCrmFile();
    if (success) {
      setCrmConnected(true);
      setCrmFileName(crmFileHandle.name);
      setCrmVveCount(0);
    }
    setShowCrmMenu(false);
  };
  var handleRefreshCrm = async () => {
    if (crmFileHandle) {
      await loadCrmFromFile();
      setCrmVveCount(Object.keys(crmData.vves).length);
    }
  };
  var handleCrmUpdate = useCallback(() => {
    setCrmVveCount(Object.keys(crmData.vves).length);
  }, []);

  // Herstel dossier-mapkoppeling bij laden (als er een opgeslagen handle is)
  useEffect(() => {
    idbGet('dossierDir').then(handle => {
      if (!handle) return;
      handle.queryPermission({
        mode: 'readwrite'
      }).then(perm => {
        setDossierDirLinked(perm === 'granted' || perm === 'prompt');
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Synchroniseer dossierdata naar vve_dossier_data.js in de gekoppelde map
  var fsApiAvailable = () => 'showDirectoryPicker' in window && !fsApiBlocked;
  var _handleFsApiError = e => {
    // SecurityError of NotAllowedError: IT-beleid blokkeert de map-picker
    if (e.name === 'SecurityError' || e.name === 'NotAllowedError') {
      setFsApiBlocked(true);
      var hasData = _currentUserEnrichData && (Object.keys(_currentUserEnrichData.data || {}).length > 0 || (_currentUserEnrichData.log || []).length > 0);
      if (hasData) {
        var doDownload = window.confirm('Toegang tot mappen is geblokkeerd door het IT-beleid op deze pc.\n\nJe hebt wel verrijkte data. Wil je die nu downloaden als JSON-bestand?\n\nPlaats het daarna handmatig in de gedeelde map.');
        if (doDownload) downloadEnrichmentFallback();
      } else {
        alert('Toegang tot mappen is geblokkeerd door het IT-beleid op deze pc.\nGebruik de downloadoptie om data handmatig te delen.');
      }
      return true; // fout afgehandeld
    }
    return false;
  };
  var syncDossierToFile = async () => {
    if (!fsApiAvailable()) {
      // Geen File System Access API: leg uit + bied download aan als er data is
      var hasData = _currentUserEnrichData && (Object.keys(_currentUserEnrichData.data || {}).length > 0 || (_currentUserEnrichData.log || []).length > 0);
      if (hasData) {
        var doDownload = window.confirm('Map koppelen werkt alleen in Chrome of Edge.\n\nJe hebt wel verrijkte data. Wil je die nu downloaden als JSON-bestand?\n\nPlaats het daarna handmatig in de gedeelde map.');
        if (doDownload) downloadEnrichmentFallback();
      } else {
        alert('Map koppelen wordt niet ondersteund in deze browser.\nGebruik Chrome of Edge voor automatische synchronisatie.');
      }
      return;
    }
    setDossierSyncStatus('syncing');
    setShowDataMenu(false);
    try {
      var dirHandle = await idbGet('dossierDir');

      // Controleer / vernieuw toestemming
      if (dirHandle) {
        var perm = await dirHandle.queryPermission({
          mode: 'readwrite'
        });
        if (perm === 'prompt') {
          var granted = await dirHandle.requestPermission({
            mode: 'readwrite'
          });
          if (granted !== 'granted') dirHandle = null;
        } else if (perm !== 'granted') {
          dirHandle = null;
        }
      }

      // Geen (geldige) handle — laat gebruiker map kiezen
      if (!dirHandle) {
        dirHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents'
        });
        await idbSet('dossierDir', dirHandle);
        setDossierDirLinked(true);
      }

      // Laad ook enrichment files van andere gebruikers
      try {
        var users = await loadUserEnrichmentFiles(dirHandle);
        setLoadedUsers(users);
      } catch (e) {
        console.warn('Enrichment files laden mislukt:', e);
      }

      // Bouw samengevoegde data: bestandsdata als basis, localStorage overschrijft
      var fileData = typeof VVE_DOSSIER_DATA !== 'undefined' ? {
        ...VVE_DOSSIER_DATA
      } : {};
      delete fileData._meta;
      var localData = loadEnrichmentData();
      var merged = {
        ...fileData
      };
      Object.entries(localData).forEach(([vveId, entry]) => {
        merged[vveId] = {
          ...(merged[vveId] || {}),
          ...entry
        };
      });
      var now = new Date();
      var output = {
        _meta: {
          gegenereerd: now.toISOString(),
          gesynchroniseerd_door: 'dashboard (browser)',
          vves_met_data: Object.keys(merged).length
        },
        ...merged
      };
      var jsonStr = JSON.stringify(output, null, 2);
      var content = `// VvE dossier data — automatisch geladen door vve_dashboard.html\n` + `// Gesynchroniseerd: ${now.toLocaleString('nl-NL')} via browser\n` + `const VVE_DOSSIER_DATA = ${jsonStr};\n`;
      var fileHandle = await dirHandle.getFileHandle('vve_dossier_data.js', {
        create: true
      });
      var writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // Sla ook enrichment bestand op voor huidige gebruiker
      if (_getCurrentUser()) {
        try {
          await saveUserEnrichmentFile(dirHandle);
          setEnrichmentDirty(false);
        } catch (e) {
          console.warn('Enrichment opslaan mislukt:', e);
        }
      }
      setDossierLastSync(now);
      setDossierSyncStatus('ok');
      setTimeout(() => setDossierSyncStatus('idle'), 3000);
    } catch (e) {
      if (e.name === 'AbortError') {
        setDossierSyncStatus('idle'); // gebruiker annuleerde mappicker
      } else if (_handleFsApiError(e)) {
        setDossierSyncStatus('idle');
      } else {
        setDossierSyncStatus('error');
        console.error('Dossier sync fout:', e);
        alert('Synchroniseren mislukt: ' + e.message);
        setTimeout(() => setDossierSyncStatus('idle'), 4000);
      }
    }
  };
  var ontkoppelDossierMap = async () => {
    await idbDel('dossierDir');
    setDossierDirLinked(false);
    setDossierLastSync(null);
    setDossierSyncStatus('idle');
  };

  // Hulpfunctie: download enrichment-bestand als de browser geen File System Access API heeft
  var downloadEnrichmentFallback = () => {
    var username = _getCurrentUser();
    if (!username) {
      setShowUsernameDialog(true);
      return;
    }
    var payload = {
      meta: {
        user: username,
        saved: new Date().toISOString(),
        version: 1
      },
      data: _currentUserEnrichData.data,
      log: _currentUserEnrichData.log
    };
    var filename = `enrichment_${username}.json`;
    var blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json'
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setEnrichmentDirty(false);
    setEnrichmentSaveStatus('ok');
    setTimeout(() => setEnrichmentSaveStatus('idle'), 3000);
    alert(`📥 "${filename}" is gedownload.\n\nPlaats dit bestand in de gedeelde map naast de andere enrichment-bestanden.\n\nDeze browser ondersteunt directe map-toegang niet. Gebruik Chrome of Edge om bestanden automatisch op te slaan.`);
  };

  // Sla alleen het enrichment bestand van de huidige gebruiker op
  var handleSaveEnrichmentOnly = async () => {
    if (!fsApiAvailable()) {
      downloadEnrichmentFallback();
      return;
    }
    if (!_getCurrentUser()) {
      setShowUsernameDialog(true);
      return;
    }
    setEnrichmentSaveStatus('saving');
    try {
      var dirHandle = await idbGet('dossierDir');
      if (dirHandle) {
        var perm = await dirHandle.queryPermission({
          mode: 'readwrite'
        });
        if (perm === 'prompt') {
          var granted = await dirHandle.requestPermission({
            mode: 'readwrite'
          });
          if (granted !== 'granted') dirHandle = null;
        } else if (perm !== 'granted') {
          dirHandle = null;
        }
      }
      if (!dirHandle) {
        dirHandle = await window.showDirectoryPicker({
          mode: 'readwrite',
          startIn: 'documents'
        });
        await idbSet('dossierDir', dirHandle);
        setDossierDirLinked(true);
      }
      await saveUserEnrichmentFile(dirHandle);
      setEnrichmentDirty(false);
      setEnrichmentSaveStatus('ok');
      setTimeout(() => setEnrichmentSaveStatus('idle'), 2500);
    } catch (e) {
      if (e.name === 'AbortError') {
        setEnrichmentSaveStatus('idle');
        return;
      }
      if (_handleFsApiError(e)) {
        setEnrichmentSaveStatus('idle');
        return;
      }
      setEnrichmentSaveStatus('error');
      console.error('Enrichment opslaan mislukt:', e);
      setTimeout(() => setEnrichmentSaveStatus('idle'), 3000);
    }
  };

  // Consolideer enrichment files (admin functie)
  var handleConsolidateEnrichment = async () => {
    try {
      var dirHandle = await idbGet('dossierDir');
      if (!dirHandle) {
        alert('Geen map gekoppeld. Gebruik eerst "Synchroniseer naar gedeelde map".');
        return;
      }
      var perm = await dirHandle.queryPermission({
        mode: 'readwrite'
      });
      if (perm === 'prompt') await dirHandle.requestPermission({
        mode: 'readwrite'
      });
      var stats = await consolidateEnrichmentFiles(dirHandle);
      alert(`Consolidatie klaar!\n${stats.users} gebruikers · ${stats.vves} VvE's · ${stats.logEntries} logregels\nenrichment_consolidated.json geschreven.`);
    } catch (e) {
      alert('Consolidatie mislukt: ' + e.message);
    }
  };

  // Import verrijkte data
  var handleImportData = event => {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = e => {
      try {
        var imported = JSON.parse(e.target.result);
        var existing = loadEnrichmentData();
        // Merge: nieuwe data overschrijft bestaande
        var merged = {
          ...existing,
          ...imported
        };
        saveEnrichmentData(merged);
        setEnrichmentCount(Object.keys(merged).length);
        alert(`Geïmporteerd! ${Object.keys(imported).length} VvE's toegevoegd/bijgewerkt. Totaal: ${Object.keys(merged).length} VvE's met verrijkte data.`);
      } catch (err) {
        alert('Fout bij importeren: ongeldig JSON bestand');
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // Import verrijkte data vanuit Excel (geëxporteerd dashboard-data xlsx)
  var handleImportXlsx = async event => {
    var file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    setXlsxImportLoading(true);
    try {
      if (!window.ExcelJS) {
        await new Promise((resolve, reject) => {
          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('ExcelJS laden mislukt'));
          document.head.appendChild(s);
        });
      }
      var buffer = await file.arrayBuffer();
      var wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      var ws = wb.worksheets[0];
      if (!ws) throw new Error('Geen werkblad gevonden');

      // Kolomnamen → kolomnummer bepalen via headerrij
      var colMap = {};
      ws.getRow(1).eachCell((cell, col) => {
        var v = cell.value?.toString().trim();
        if (v) colMap[v] = col;
      });
      var vveIdCol = colMap['VvE-identificatie'];
      if (!vveIdCol) throw new Error('Kolom "VvE-identificatie" niet gevonden. Gebruik een dashboard-data export.');

      // Welke velden importeren + bijbehorende kolomkop
      var VELDEN = {
        nickname: 'Nickname',
        adviestraject: 'Adviestraject',
        intake: '1. Intake',
        bureau: 'Bureau',
        procesbegeleider: 'Procesbegeleider',
        mwa: '2. MWA',
        verdieping: '3. Verdieping',
        uitvoering: '4. Uitvoering',
        notities: 'Notities',
        beheerder: 'Beheerder'
      };
      var fieldCols = Object.fromEntries(Object.entries(VELDEN).filter(([, header]) => colMap[header] !== undefined).map(([field, header]) => [field, colMap[header]]));
      var imported = {};
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        var vveId = row.getCell(vveIdCol).value?.toString().trim();
        if (!vveId?.startsWith('NL.IMKAD.')) return;
        var entry = {};
        for (var _ref6 of Object.entries(fieldCols)) {
          var _ref5 = _slicedToArray(_ref6, 2);
          var field = _ref5[0];
          var col = _ref5[1];
          var raw = row.getCell(col).value;
          var str = raw !== null && raw !== undefined ? raw.toString().trim() : '';
          if (str) entry[field] = str;
        }
        if (Object.keys(entry).length > 0) imported[vveId] = entry;
      });
      var updatedCount = Object.keys(imported).length;
      if (updatedCount === 0) {
        alert('Geen verrijkte data gevonden.\n\nZorg dat "VvE-identificatie" aanwezig is en de gele kolommen (Nickname, Adviestraject, etc.) gevuld zijn.');
        return;
      }

      // Field-level merge: bestaande waarden blijven waar Excel leeg is
      var existing = loadEnrichmentData();
      var merged = {
        ...existing
      };
      for (var _ref9 of Object.entries(imported)) {
        var _ref8 = _slicedToArray(_ref9, 2);
        var vveId = _ref8[0];
        var fields = _ref8[1];
        merged[vveId] = {
          ...(existing[vveId] || {}),
          ...fields
        };
      }
      saveEnrichmentData(merged);
      setEnrichmentCount(Object.keys(merged).length);
      alert(`Excel geïmporteerd! ${updatedCount} VvE${updatedCount !== 1 ? "'s" : ''} bijgewerkt.\nTotaal: ${Object.keys(merged).length} VvE's met verrijkte data.`);
    } catch (err) {
      alert(`Fout bij importeren: ${err.message}`);
    } finally {
      setXlsxImportLoading(false);
    }
  };

  // Update enrichment count when changed
  var handleEnrichmentChange = useCallback(() => {
    setEnrichmentCount(Object.keys(loadEnrichmentData()).length);
  }, []);

  // Bouw bestandsnaam op basis van actieve filters
  var buildExportSlug = () => {
    var toSlug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    var parts = [];
    if (selectedGrootte.size > 0) {
      var map = {
        mini: 'mini-vves',
        klein: 'kleine-vves',
        groot: 'grote-vves'
      };
      [...selectedGrootte].forEach(k => parts.push(map[k] || k));
    }
    if (selectedTijdvak.size > 0) {
      [...selectedTijdvak].forEach(k => parts.push(toSlug('tijdvak-' + k)));
    }
    if (selectedWarmte.size > 0) {
      [...selectedWarmte].forEach(k => parts.push(toSlug('warmte-' + k)));
    }
    if (selectedBuurt.size > 0) {
      var buurten = [...selectedBuurt].sort().map(toSlug);
      buurten.length <= 2 ? parts.push(...buurten) : parts.push(`${buurten.length}-buurten`);
    }
    if (selectedMonument.size > 0) {
      var _map2 = {
        rijksmonument: 'rijksmonument',
        gemeentelijk: 'gem-monument',
        orde2: 'orde2',
        geen: 'geen-monument'
      };
      [...selectedMonument].forEach(k => parts.push(_map2[k] || k));
    }
    if (selectedBeschermd.has('ja')) parts.push('beschermd');
    if (selectedKvk.has('zonder_kvk')) parts.push('zonder-kvk');else if (selectedKvk.size > 0) parts.push('met-kvk');
    if (selectedBouwjaar.size > 0) {
      var cats = bouwjaarCategories.filter(c => selectedBouwjaar.has(c.key));
      if (cats.length === 1) {
        parts.push(cats[0].key);
      } else {
        var _lo = Math.min(...cats.map(c => c.min === 0 ? 1800 : c.min));
        var _hi = Math.max(...cats.map(c => c.max === 9999 ? new Date().getFullYear() : c.max));
        parts.push(`bouwjaar-${_lo}-${_hi}`);
      }
    }
    if (selectedGemengd.has('ja')) parts.push('gemengd');
    if (selectedHoofdsplitsing.has('ja')) parts.push('hoofdsplitsing');
    if (selectedWoz.has('boven')) parts.push('hoge-woz');
    if (selectedWoz.has('onder')) parts.push('lage-woz');
    if (selectedGespikkeld.has('ja')) parts.push('gespikkeld');
    if (selectedCorpPct.size > 0) parts.push(`corp-${[...selectedCorpPct].join('-')}`);
    if (search.length >= 2) parts.push(toSlug(search));
    return parts.length > 0 ? parts.join('-') : 'alle-vves';
  };

  // CSV Export functie
  var exportToCsv = useCallback(includeAddresses => {
    setShowCsvMenu(false);
    if (includeAddresses) {
      // Export alle adressen
      var headers = ['id', 'vve_identificatie', 'statutairenaam', 'kvknummer', 'aantal_woningen', 'nickname', 'straatnaam', 'huisnummer', 'huisletter', 'huisnummertoevoeging', 'postcode', 'buurt', 'wijk', 'stadsdeel', 'bouwjaar', 'oppervlakte', 'woz2024', 'woz2025', 'energielabel', 'monumentale_status', 'beschermd_stadsgezicht', 'basiseenheidtype', 'verblijfsobject_id', 'gerelateerd_pand_id', 'warmte_tijdvak', 'warmtevoorziening'];
      var rows = fullyFilteredData.map(item => {
        var warmte = getWarmteProg(item);
        var enr = getVveEnrichment(item.vve_identificatie);
        return [item.id || '', item.vve_identificatie || '', `"${(item.statutairenaam || '').replace(/"/g, '""')}"`, item.kvknummer || lookupKvkNummer(item.vve_identificatie) || enr?.kvkNummer || '', item.aantal_woon_adr_in_vve || '', '',
        // nickname
        `"${(item.straatnaam || '').replace(/"/g, '""')}"`, item.huisnummer || '', item.huisletter || '', item.huisnummertoevoeging || '', item.postcode || '', `"${(item.buurt || '').replace(/"/g, '""')}"`, `"${(item.wijk || '').replace(/"/g, '""')}"`, `"${(item.stadsdeel || '').replace(/"/g, '""')}"`, item.bouwjaar_gerelateerd_pand || '', item.oppervlakte || '', item.woz2024 || '', item.woz2025 || '', item.energielabel || '', `"${(item.monumentale_status || '').replace(/"/g, '""')}"`, getBeschermdGezicht(item.vve_identificatie) || '', `"${(item.basiseenheidtype || '').replace(/"/g, '""')}"`, item.verblijfsobject_id || '', item.gerelateerd_pand_id || '', warmte?.tijdvak || '', (getWarmteProg(item) || {}).warmte || ''];
      });
      var csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
      var blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-adressen-${buildExportSlug()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // Export alleen VvE's (geaggregeerd)
      var _headers = ['id', 'vve_identificatie', 'statutairenaam', 'warmte_tijdvak', 'warmtevoorziening', 'kvknummer', 'aantal_woningen', 'nickname', 'adviestraject', '1_intake', 'bureau', 'procesbegeleider', '2_MWA', '3_verdieping', '4_uitvoering', 'notities', 'aantal_adressen', 'straatnaam', 'huisnummer_laag', 'huisnummer_hoog', 'postcode', 'buurt', 'wijk', 'stadsdeel', 'bouwjaar', 'gem_woz', 'gem_energielabel', 'monumentale_status', 'beschermd_stadsgezicht'];
      var _rows = groupedByVve.map(group => {
        var vve = group.vve;
        var addresses = group.addresses;
        var sortedByNum = [...addresses].sort((a, b) => (parseInt(a.huisnummer) || 0) - (parseInt(b.huisnummer) || 0));
        var lowestNum = sortedByNum[0]?.huisnummer || '';
        var highestNum = sortedByNum[sortedByNum.length - 1]?.huisnummer || '';
        var wozValues = addresses.map(a => getActiveWoz(a)).filter(Boolean);
        var avgWoz = wozValues.length > 0 ? Math.round(wozValues.reduce((a, b) => a + b, 0) / wozValues.length) : '';
        var avgEnergy = getAverageEnergyLabel(addresses);
        var warmte = getWarmteProg(vve);
        var enr = getVveEnrichment(vve.vve_identificatie);
        return [vve.id || '', vve.vve_identificatie || '', `"${(vve.statutairenaam || '').replace(/"/g, '""')}"`, warmte?.tijdvak || '', (getWarmteProg(vve) || {}).warmte || '', vve.kvknummer || lookupKvkNummer(vve.vve_identificatie) || enr?.kvkNummer || '', vve.aantal_woon_adr_in_vve || '', '',
        // nickname
        '', '', '', '', '', '', '', '',
        // adviestraject, 1_intake, bureau, procesbegeleider, 2_MWA, 3_verdieping, 4_uitvoering, notities
        addresses.length, `"${(vve.straatnaam || '').replace(/"/g, '""')}"`, lowestNum, highestNum, vve.postcode || '', `"${(vve.buurt || '').replace(/"/g, '""')}"`, `"${(vve.wijk || '').replace(/"/g, '""')}"`, `"${(vve.stadsdeel || '').replace(/"/g, '""')}"`, vve.bouwjaar_gerelateerd_pand || '', avgWoz, avgEnergy, `"${(vve.monumentale_status || '').replace(/"/g, '""')}"`, getBeschermdGezicht(vve.vve_identificatie) || ''];
      });
      var _csvContent = [_headers.join(';'), ..._rows.map(r => r.join(';'))].join('\n');
      var _blob = new Blob(['\ufeff' + _csvContent], {
        type: 'text/csv;charset=utf-8;'
      });
      var _url = URL.createObjectURL(_blob);
      var _link = document.createElement('a');
      _link.href = _url;
      _link.download = `dashboard-data-${buildExportSlug()}.csv`;
      _link.click();
      URL.revokeObjectURL(_url);
    }
  }, [fullyFilteredData, groupedByVve]);
  var exportToXlsx = async () => {
    setShowCsvMenu(false);
    setXlsxLoading(true);
    try {
      // Lazy load ExcelJS
      if (!window.ExcelJS) {
        await new Promise((resolve, reject) => {
          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('ExcelJS laden mislukt'));
          document.head.appendChild(s);
        });
      }
      var slug = buildExportSlug();
      var wb = new ExcelJS.Workbook();
      wb.creator = 'VvE Dashboard Haarlem';
      wb.created = new Date();
      var ws = wb.addWorksheet('VvE data', {
        views: [{
          state: 'frozen',
          xSplit: 0,
          ySplit: 1,
          activeCell: 'A2'
        }]
      });
      ws.columns = [{
        header: 'ID',
        key: 'id',
        width: 10
      }, {
        header: 'VvE-identificatie',
        key: 'vve_id',
        width: 38
      }, {
        header: 'VvE naam',
        key: 'naam',
        width: 45
      }, {
        header: 'Tijdvak',
        key: 'warmteplan',
        width: 16
      }, {
        header: 'Warmte',
        key: 'warmtevoorziening',
        width: 22
      }, {
        header: 'KvK nummer',
        key: 'kvk',
        width: 14
      }, {
        header: 'Woningen',
        key: 'woningen',
        width: 11
      }, {
        header: 'Nickname',
        key: 'nickname',
        width: 20
      }, {
        header: 'Adviestraject',
        key: 'adviestraject',
        width: 16
      }, {
        header: '1. Intake',
        key: 'intake',
        width: 13
      }, {
        header: 'Bureau',
        key: 'bureau',
        width: 16
      }, {
        header: 'Procesbegeleider',
        key: 'procesbegeleider',
        width: 18
      }, {
        header: '2. MWA',
        key: 'mwa',
        width: 13
      }, {
        header: '3. Verdieping',
        key: 'verdieping',
        width: 14
      }, {
        header: '4. Uitvoering',
        key: 'uitvoering',
        width: 14
      }, {
        header: 'Notities',
        key: 'notities',
        width: 32
      }, {
        header: 'Beheerder',
        key: 'beheerder',
        width: 22
      }, {
        header: 'Adressen',
        key: 'adressen',
        width: 11
      }, {
        header: 'Straatnaam',
        key: 'straat',
        width: 24
      }, {
        header: 'Nr laag',
        key: 'nr_laag',
        width: 9
      }, {
        header: 'Nr hoog',
        key: 'nr_hoog',
        width: 9
      }, {
        header: 'Postcode',
        key: 'postcode',
        width: 10
      }, {
        header: 'Buurt',
        key: 'buurt',
        width: 24
      }, {
        header: 'Wijk',
        key: 'wijk',
        width: 20
      }, {
        header: 'Stadsdeel',
        key: 'stadsdeel',
        width: 14
      }, {
        header: 'Bouwjaar',
        key: 'bouwjaar',
        width: 10
      }, {
        header: 'Gem. WOZ',
        key: 'woz',
        width: 13
      }, {
        header: 'Gem. label',
        key: 'label',
        width: 11
      }, {
        header: 'Monument',
        key: 'monument',
        width: 22
      }, {
        header: 'Beschermd stadsgezicht',
        key: 'beschermd',
        width: 24
      }];

      // Stijl headerrij
      var headerRow = ws.getRow(1);
      headerRow.height = 20;
      headerRow.eachCell(cell => {
        cell.font = {
          bold: true,
          color: {
            argb: 'FFFFFFFF'
          },
          size: 10,
          name: 'Calibri'
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: 'FF742774'
          }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: false
        };
        cell.border = {
          bottom: {
            style: 'medium',
            color: {
              argb: 'FF5C1F5C'
            }
          }
        };
      });

      // Autofilter over alle kolommen
      ws.autoFilter = {
        from: 'A1',
        to: 'AD1'
      };

      // Invoerkolommen (1-based): nickname t/m beheerder
      var inputCols = new Set([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);

      // Verrijkte data eenmalig laden voor de hele export
      var _allEnr = loadEnrichmentData();
      var _enrKeys = Object.keys(_allEnr);
      var _maxNaamLen = 16; // wordt bijgehouden voor autofit naam-kolom
      groupedByVve.forEach((group, idx) => {
        var vve = group.vve;
        _maxNaamLen = Math.max(_maxNaamLen, (vve.statutairenaam || '').length);
        var addresses = group.addresses;
        var sorted = [...addresses].sort((a, b) => (parseInt(a.huisnummer) || 0) - (parseInt(b.huisnummer) || 0));
        var wozVals = addresses.map(a => getActiveWoz(a)).filter(Boolean);
        var avgWoz = wozVals.length > 0 ? Math.round(wozVals.reduce((a, b) => a + b, 0) / wozVals.length) : null;
        var avgEnergy = getAverageEnergyLabel(addresses);
        var warmte = getWarmteProg(vve);
        var enr = _enrKeys.length > 0 ? _allEnr[vve.vve_identificatie] || null : null;
        var row = ws.addRow({
          id: vve.id || '',
          vve_id: vve.vve_identificatie || '',
          naam: vve.statutairenaam || '',
          warmteplan: warmte?.tijdvak || '',
          warmtevoorziening: (getWarmteProg(vve) || {}).warmte || '',
          kvk: vve.kvknummer || lookupKvkNummer(vve.vve_identificatie) || enr?.kvkNummer || '',
          woningen: vve.aantal_woon_adr_in_vve || addresses.length,
          nickname: enr?.nickname || '',
          adviestraject: enr?.adviestraject || '',
          intake: enr?.intake || '',
          bureau: enr?.bureau || '',
          procesbegeleider: enr?.procesbegeleider || '',
          mwa: enr?.mwa || '',
          verdieping: enr?.verdieping || '',
          uitvoering: enr?.uitvoering || '',
          notities: enr?.notities || '',
          beheerder: enr?.beheerder || '',
          adressen: addresses.length,
          straat: vve.straatnaam || '',
          nr_laag: sorted[0]?.huisnummer || '',
          nr_hoog: sorted[sorted.length - 1]?.huisnummer || '',
          postcode: vve.postcode || '',
          buurt: vve.buurt || '',
          wijk: vve.wijk || '',
          stadsdeel: vve.stadsdeel || '',
          bouwjaar: vve.bouwjaar_gerelateerd_pand || '',
          woz: avgWoz,
          label: avgEnergy !== '-' ? avgEnergy : '',
          monument: vve.monumentale_status || '',
          beschermd: getBeschermdGezicht(vve.vve_identificatie) || ''
        });
        var _naamLen = (vve.statutairenaam || '').length;
        row.height = _naamLen > 45 ? 28 : 15;
        var rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF5F3FF'; // wit / licht paars
        var dotted = {
          style: 'dotted',
          color: {
            argb: 'FFCCCCCC'
          }
        };
        row.eachCell((cell, colNum) => {
          cell.font = {
            size: 10,
            name: 'Calibri'
          };
          cell.alignment = colNum === 3 ? {
            vertical: 'middle',
            wrapText: true
          } : {
            vertical: 'middle'
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
              argb: inputCols.has(colNum) ? 'FFFEF9C3' : rowBg
            }
          };
          cell.border = {
            top: dotted,
            left: dotted,
            bottom: dotted,
            right: dotted
          };
        });
        if (avgWoz) row.getCell('woz').numFmt = '€#,##0';
        row.getCell('naam').alignment = {
          vertical: 'middle',
          wrapText: true
        };
        row.getCell('woningen').alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        row.getCell('adressen').alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        row.getCell('bouwjaar').alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        row.getCell('label').alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
      });

      // Autofit naam-kolom: breed genoeg voor max 2 regels (langste naam / 2), cap 50
      ws.getColumn('naam').width = Math.max(20, Math.min(Math.ceil(_maxNaamLen / 2 * 1.2), 50));
      var buffer = await wb.xlsx.writeBuffer();
      var blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-data-${slug}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Excel exporteren mislukt: ' + e.message);
    } finally {
      setXlsxLoading(false);
    }
  };
  var exportAddressesXlsx = async () => {
    setShowCsvMenu(false);
    setXlsxAdressenLoading(true);
    try {
      if (!window.ExcelJS) {
        await new Promise((resolve, reject) => {
          var s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
          s.onload = resolve;
          s.onerror = () => reject(new Error('ExcelJS laden mislukt'));
          document.head.appendChild(s);
        });
      }
      var slug = buildExportSlug();
      var wb = new ExcelJS.Workbook();
      wb.creator = 'VvE Dashboard Haarlem';
      wb.created = new Date();
      var ws = wb.addWorksheet('Adressen', {
        views: [{
          state: 'frozen',
          xSplit: 0,
          ySplit: 1,
          activeCell: 'A2'
        }]
      });
      ws.columns = [{
        header: 'ID',
        key: 'id',
        width: 8
      }, {
        header: 'VvE-identificatie',
        key: 'vve_id',
        width: 38
      }, {
        header: 'VvE naam',
        key: 'naam',
        width: 40
      }, {
        header: 'KvK nummer',
        key: 'kvk',
        width: 14
      }, {
        header: 'Woningen',
        key: 'woningen',
        width: 11
      }, {
        header: 'Nickname',
        key: 'nickname',
        width: 20
      }, {
        header: 'Straatnaam',
        key: 'straat',
        width: 24
      }, {
        header: 'Huisnummer',
        key: 'huisnummer',
        width: 12
      }, {
        header: 'Huisletter',
        key: 'huisletter',
        width: 12
      }, {
        header: 'Toevoeging',
        key: 'toevoeging',
        width: 14
      }, {
        header: 'Postcode',
        key: 'postcode',
        width: 10
      }, {
        header: 'Buurt',
        key: 'buurt',
        width: 24
      }, {
        header: 'Wijk',
        key: 'wijk',
        width: 20
      }, {
        header: 'Stadsdeel',
        key: 'stadsdeel',
        width: 14
      }, {
        header: 'Bouwjaar',
        key: 'bouwjaar',
        width: 10
      }, {
        header: 'Opp. (m²)',
        key: 'opp',
        width: 12
      }, {
        header: 'WOZ 2024',
        key: 'woz2024',
        width: 13
      }, {
        header: 'WOZ 2025',
        key: 'woz',
        width: 13
      }, {
        header: 'Energielabel',
        key: 'label',
        width: 14
      }, {
        header: 'Monumentale status',
        key: 'monument',
        width: 22
      }, {
        header: 'Beschermd stadsgezicht',
        key: 'beschermd',
        width: 24
      }, {
        header: 'Basiseenheidtype',
        key: 'type',
        width: 20
      }, {
        header: 'Verblijfsobject ID',
        key: 'vbo_id',
        width: 20
      }, {
        header: 'Pand ID',
        key: 'pand_id',
        width: 20
      }, {
        header: 'Tijdvak',
        key: 'warmteplan',
        width: 16
      }, {
        header: 'Warmte',
        key: 'warmtevoorziening',
        width: 22
      }];

      // Stijl headerrij
      var headerRow = ws.getRow(1);
      headerRow.height = 20;
      headerRow.eachCell(cell => {
        cell.font = {
          bold: true,
          color: {
            argb: 'FFFFFFFF'
          },
          size: 10,
          name: 'Calibri'
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: 'FF742774'
          }
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: false
        };
        cell.border = {
          bottom: {
            style: 'medium',
            color: {
              argb: 'FF5C1F5C'
            }
          }
        };
      });
      ws.autoFilter = {
        from: 'A1',
        to: 'Y1'
      };

      // Invoerkolom (1-based): nickname
      var adresInputCols = new Set([6]);
      fullyFilteredData.forEach((item, idx) => {
        var warmte = getWarmteProg(item);
        var enr = getVveEnrichment(item.vve_identificatie);
        var row = ws.addRow({
          id: item.id || '',
          vve_id: item.vve_identificatie || '',
          naam: item.statutairenaam || '',
          kvk: item.kvknummer || lookupKvkNummer(item.vve_identificatie) || enr?.kvkNummer || '',
          woningen: item.aantal_woon_adr_in_vve || '',
          nickname: '',
          straat: item.straatnaam || '',
          huisnummer: item.huisnummer || '',
          huisletter: item.huisletter || '',
          toevoeging: item.huisnummertoevoeging || '',
          postcode: item.postcode || '',
          buurt: item.buurt || '',
          wijk: item.wijk || '',
          stadsdeel: item.stadsdeel || '',
          bouwjaar: item.bouwjaar_gerelateerd_pand || '',
          opp: item.oppervlakte || '',
          woz2024: item.woz2024 || null,
          woz: item.woz2025 || null,
          label: item.energielabel || '',
          monument: item.monumentale_status || '',
          beschermd: getBeschermdGezicht(item.vve_identificatie) || '',
          type: item.basiseenheidtype || '',
          vbo_id: item.verblijfsobject_id || '',
          pand_id: item.gerelateerd_pand_id || '',
          warmteplan: warmte?.tijdvak || '',
          warmtevoorziening: (getWarmteProg(item) || {}).warmte || ''
        });
        row.height = 15;
        var rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF5F3FF';
        var dotted = {
          style: 'dotted',
          color: {
            argb: 'FFCCCCCC'
          }
        };
        row.eachCell((cell, colNum) => {
          cell.font = {
            size: 10,
            name: 'Calibri'
          };
          cell.alignment = {
            vertical: 'middle'
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
              argb: adresInputCols.has(colNum) ? 'FFFEF9C3' : rowBg
            }
          };
          cell.border = {
            top: dotted,
            left: dotted,
            bottom: dotted,
            right: dotted
          };
        });
        if (item.woz2024) row.getCell('woz2024').numFmt = '€#,##0';
        if (item.woz2025) row.getCell('woz').numFmt = '€#,##0';
        row.getCell('huisnummer').alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        row.getCell('bouwjaar').alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        row.getCell('opp').alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
        row.getCell('label').alignment = {
          vertical: 'middle',
          horizontal: 'center'
        };
      });
      var buffer = await wb.xlsx.writeBuffer();
      var blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = `dashboard-adressen-${slug}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Excel exporteren mislukt: ' + e.message);
    } finally {
      setXlsxAdressenLoading(false);
    }
  };
  var exportEnrichedCsv = useCallback(() => {
    setShowCsvMenu(false);
    var allEnrichment = loadEnrichmentData();
    var enrichedIds = Object.keys(allEnrichment);
    if (enrichedIds.length === 0) return;
    var headers = ['vve_identificatie', 'statutairenaam', 'kvknummer', 'adressen', 'buurt', 'wijk', 'aantal_woningen', 'beschermd_stadsgezicht', 'bestuur_naam', 'bestuur_email', 'bestuur_telefoon', 'duurzaamheid_naam', 'duurzaamheid_email', 'duurzaamheid_telefoon', 'kvk_nummer_handmatig', 'notities', 'laatst_gewijzigd'];

    // Zoek VvE-data per enriched vve_identificatie
    var vveMap = {};
    VVE_DATA.forEach(item => {
      if (!vveMap[item.vve_identificatie]) vveMap[item.vve_identificatie] = item;
    });
    var esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
    var rows = enrichedIds.map(vveId => {
      var enr = allEnrichment[vveId];
      var vve = vveMap[vveId];
      // Verzamel adressen voor deze VvE
      var adressen = VVE_DATA.filter(a => a.vve_identificatie === vveId);
      var adresStr = [...new Set(adressen.map(a => `${a.straatnaam || ''} ${a.huisnummer || ''}${a.huisletter || ''}${a.huisnummertoevoeging ? '-' + a.huisnummertoevoeging : ''}`.trim()))].join(', ');
      return [vveId, esc(vve?.statutairenaam), vve?.kvknummer || lookupKvkNummer(vveId) || enr?.kvkNummer || '', esc(adresStr), esc(vve?.buurt), esc(vve?.wijk), vve?.aantal_woon_adr_in_vve || '', getBeschermdGezicht(vveId) || '', esc(enr?.bestuurNaam), esc(enr?.bestuurEmail), esc(enr?.bestuurTelefoon), esc(enr?.duurzaamheidNaam), esc(enr?.duurzaamheidEmail), esc(enr?.duurzaamheidTelefoon), enr?.kvkNummer || '', esc(enr?.notities), enr?.lastModified || ''];
    });
    var csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    var blob = new Blob(['\ufeff' + csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = `vve_verrijkte_data_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);
  var exportKvkCsv = useCallback(() => {
    setShowCsvMenu(false);
    var allEnrichment = loadEnrichmentData();
    var vveMap = {};
    var eigenIds = new Set();
    VVE_DATA.forEach(item => {
      var id = item.vve_identificatie;
      if (!vveMap[id]) vveMap[id] = item;
      if (item.kvknummer) eigenIds.add(id);
    });
    // Combineer lookup + enrichment, lookup wint bij conflict
    // Sluit VvEs uit die al een eigen KvK in de primaire dataset hebben
    var combined = {};
    // 1. enrichment (handmatig ingevoerd)
    Object.entries(allEnrichment).forEach(([vveId, enr]) => {
      if (enr?.kvkNummer && !eigenIds.has(vveId)) combined[vveId] = { kvk: enr.kvkNummer, bron: 'handmatig' };
    });
    // 2. kvk_lookup.js (overschrijft enrichment \u2014 lookup is de bronwaarheid)
    if (typeof KVK_LOOKUP !== 'undefined') {
      Object.entries(KVK_LOOKUP).forEach(([vveId, kvk]) => {
        if (!eigenIds.has(vveId)) combined[vveId] = { kvk, bron: 'lookup' };
      });
    }
    var entries = Object.entries(combined);
    if (entries.length === 0) return;
    var esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
    var headers = ['vve_identificatie', 'statutairenaam', 'kvknummer', 'bron'];
    var rows = entries.map(([vveId, { kvk, bron }]) => {
      var vve = vveMap[vveId];
      return [vveId, esc(vve?.statutairenaam), kvk, bron];
    });
    var csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    var blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = `vve_kvk_nummers_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  var exportMissendeKvk = useCallback(() => {
    setShowCsvMenu(false);
    var vveMap = {};
    var vveAddresses = {};
    VVE_DATA.forEach(item => {
      var id = item.vve_identificatie;
      if (!vveMap[id]) { vveMap[id] = item; vveAddresses[id] = []; }
      vveAddresses[id].push(item);
    });
    var missing = Object.values(vveMap).filter(item => getKvkKey(item) === 'zonder_kvk');
    if (missing.length === 0) return;
    var esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
    var headers = ['vve_identificatie', 'statutairenaam', 'buurt', 'wijk', 'postcode', 'straatnamen', 'huisnummer_laag', 'huisnummer_hoog', 'aantal_adressen'];
    var rows = missing.map(vve => {
      var adr = vveAddresses[vve.vve_identificatie] || [];
      var straten = [...new Set(adr.map(a => a.straatnaam).filter(Boolean))].join(', ');
      var nrs = adr.map(a => parseInt(a.huisnummer)).filter(n => !isNaN(n));
      var nrLaag = nrs.length ? Math.min(...nrs) : '';
      var nrHoog = nrs.length ? Math.max(...nrs) : '';
      var postcode = [...new Set(adr.map(a => a.postcode).filter(Boolean))].join(', ');
      return [vve.vve_identificatie, esc(vve.statutairenaam), esc(vve.buurt), esc(vve.wijk), esc(postcode), esc(straten), nrLaag, nrHoog, adr.length];
    });
    var csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    var blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = `vve_zonder_kvk_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  // Excel grid column template
  var xlBaseTemplate = '36px minmax(200px,1fr)' + (MAPNAMEN_AAN ? ' 230px' : '') + ' 52px 52px 108px 52px 76px 68px 80px 72px 34px 34px 34px';
  var xlColTemplate = dossierVisible ? xlBaseTemplate + ' 34px 88px 68px 84px' : xlBaseTemplate;
  var xlMinWidth = (dossierVisible ? 1160 : 874) + (MAPNAMEN_AAN ? 230 : 0);
  var xlColLabels = ['', 'Naam', ...(MAPNAMEN_AAN ? ['Map'] : []), 'Won.', 'Label', 'Buurt', 'Bj.', 'WOZ ' + activeWozJaar, 'Warmtew.', 'Warmte', 'Wijk', 'Mon.', 'Bsch.', 'Gem.', ...(dossierVisible ? ['Traj.', 'Bureau', 'Intake', 'Beheerder'] : [])];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    },
    className: "font-segoe"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#217346',
      padding: '5px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "white",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'white',
      lineHeight: 1.2
    }
  }, "VvE Dashboard"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.7)',
      lineHeight: 1.3
    }
  }, data.length.toLocaleString(), " adressen · ", totalVves.toLocaleString(), " VvE's · Haarlem · Build ", APP_BUILD + (APP_EXTERN ? 'e' : '')))), /*#__PURE__*/React.createElement("div", {
    className: "hidden lg:flex items-center gap-2",
    style: {
      marginLeft: 'auto',
      background: '#ffd700',
      padding: '3px 10px',
      borderRadius: 2
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 13,
      height: 13,
      color: '#7a5000',
      flexShrink: 0
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2.5,
    d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#7a5000'
    }
  }, "Intern gebruik — nog ", Math.max(0, Math.ceil((APP_EXPIRY_DATE - new Date()) / 86400000)), " dagen actief")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowFilters(!showFilters),
    className: "lg:hidden",
    style: {
      marginLeft: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      background: 'rgba(255,255,255,0.2)',
      border: 'none',
      borderRadius: 2,
      fontSize: 11,
      color: 'white',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 13,
      height: 13
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
  })), "Filters ", hasActiveFilters && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      background: '#ffd700',
      borderRadius: '50%',
      display: 'inline-block'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'white',
      borderBottom: '1px solid #d0d0d0',
      padding: '4px 8px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      maxWidth: 500
    }
  }, /*#__PURE__*/React.createElement(SearchBar, {
    value: search,
    onChange: handleSearch,
    onParsedEmail: handleParsedEmail,
    parsedData: parsedEmail,
    placeholder: "Zoek op adres, naam, postcode, buurt, nickname..."
  })), /*#__PURE__*/React.createElement("div", {
    id: "vve-toolbar-actions",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "hidden lg:flex",
    onClick: () => cycleDetailPanel(),
    title: showDetailPanelDesktop === 'hidden' ? 'Toon splitscreen (spatie)' : showDetailPanelDesktop === 'split' ? 'Volledig scherm (spatie)' : 'Verberg paneel (spatie)',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: '3px 8px',
      border: '1px solid #d0d0d0',
      background: showDetailPanelDesktop === 'hidden' ? 'white' : '#e8f4ee',
      fontSize: 11,
      cursor: 'pointer',
      color: showDetailPanelDesktop === 'hidden' ? '#606060' : '#217346',
      flexShrink: 0,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {width: 13, height: 13, flexShrink: 0},
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, showDetailPanelDesktop === 'hidden' ? /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2,
    d: "M4 6h16M4 12h10m-10 6h16"
  }) : showDetailPanelDesktop === 'split' ? /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2,
    d: "M13 5H3m0 0v14m0-14h18M3 19h10m7-7H13m0 0V5m0 7v7"
  }) : /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2,
    d: "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
  })), "Details")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShowCsvMenu(!showCsvMenu);
      setShowUserMenu(false);
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      border: '1px solid #d0d0d0',
      background: 'white',
      fontSize: 11,
      cursor: 'pointer',
      color: '#404040',
      whiteSpace: 'nowrap'
    },
    title: "Exporteer"
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 12,
      height: 12,
      flexShrink: 0
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
  })), "Export ", /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 9,
      height: 9
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M19 9l-7 7-7-7"
  }))), showCsvMenu && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-10",
    onClick: () => setShowCsvMenu(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute right-0 top-full mt-1 pa-card py-1 z-20 min-w-[240px]"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: exportToXlsx,
    disabled: xlsxLoading,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, xlsxLoading ? /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-green-600 shrink-0 animate-spin",
    fill: "none",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("circle", {
    className: "opacity-25",
    cx: "12",
    cy: "12",
    r: "10",
    stroke: "currentColor",
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("path", {
    className: "opacity-75",
    fill: "currentColor",
    d: "M4 12a8 8 0 018-8v8z"
  })) : /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-green-600 shrink-0",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M9 17v-2m3 2v-4m3 4v-6M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
  })), /*#__PURE__*/React.createElement("span", {
    className: "truncate text-pa-gray-600 font-mono text-[10px]"
  }, xlsxLoading ? 'Excel genereren…' : `dashboard-data-${buildExportSlug()}.xlsx`)), /*#__PURE__*/React.createElement("button", {
    onClick: exportAddressesXlsx,
    disabled: xlsxAdressenLoading,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, xlsxAdressenLoading ? /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-green-600 shrink-0 animate-spin",
    fill: "none",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("circle", {
    className: "opacity-25",
    cx: "12",
    cy: "12",
    r: "10",
    stroke: "currentColor",
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("path", {
    className: "opacity-75",
    fill: "currentColor",
    d: "M4 12a8 8 0 018-8v8z"
  })) : /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-green-600 shrink-0",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
  }), /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M15 11a3 3 0 11-6 0 3 3 0 016 0z"
  })), /*#__PURE__*/React.createElement("span", {
    className: "truncate text-pa-gray-600 font-mono text-[10px]"
  }, xlsxAdressenLoading ? 'Excel genereren…' : `dashboard-adressen-${buildExportSlug()}.xlsx`)), (() => {
    var _eigenIds = new Set(VVE_DATA.filter(d => d.kvknummer).map(d => d.vve_identificatie));
    var _enr = loadEnrichmentData();
    var nKvk = (typeof KVK_LOOKUP !== 'undefined' ? Object.keys(KVK_LOOKUP).filter(id => !_eigenIds.has(id)).length : 0) + Object.entries(_enr).filter(([id, e]) => e?.kvkNummer && !_eigenIds.has(id) && !(typeof KVK_LOOKUP !== 'undefined' && KVK_LOOKUP[id])).length;
    return /*#__PURE__*/React.createElement("button", {
      onClick: () => exportKvkCsv(),
      className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2 border-t border-pa-gray-100"
    }, /*#__PURE__*/React.createElement("svg", {
      className: "w-4 h-4 text-pa-gray-400",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    })), "KvK lookup + handmatig (", nKvk, ")");
  })(), (() => {
    var n = Object.entries(loadEnrichmentData()).filter(([id, e]) => e?.kvkNummer && !lookupKvkNummer(id)).length;
    return n > 0 ? /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        var k = exportKvkHandmatigJs();
        if (k > 0) setShowCsvMenu(false);
      },
      className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2 border-t border-pa-gray-100"
    }, /*#__PURE__*/React.createElement("svg", {
      className: "w-4 h-4 text-pa-gray-400",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
    })), "kvk_handmatig.txt (", n, ")") : null;
  })(), (() => {
    var zonKvk = data.reduce((s, item) => { if (!s.has(item.vve_identificatie)) { s.add(item.vve_identificatie); } return s; }, new Set());
    var count = [...zonKvk].filter(id => { var item = data.find(d => d.vve_identificatie === id); return item && getKvkKey(item) === 'zonder_kvk'; }).length;
    return count > 0 ? /*#__PURE__*/React.createElement("button", {
      onClick: () => exportMissendeKvk(),
      className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2 border-t border-pa-gray-100"
    }, /*#__PURE__*/React.createElement("svg", {
      className: "w-4 h-4 text-pa-gray-400",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
    })), "VvE's zonder KvK (", count, ")") : null;
  })(), enrichmentCount > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => exportEnrichedCsv(),
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2 border-t border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
  })), "Verrijkte VvE's (", enrichmentCount, ")"), VVE_DATA.some(d => d._verdacht) && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      exportVerdachteVves();
      setShowCsvMenu(false);
    },
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2 border-t border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-orange-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
  })), "Verdachte VvE's (22)")))), crmEnabled && /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShowCrmMenu(!showCrmMenu);
      setShowUserMenu(false);
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      border: '1px solid #d0d0d0',
      background: crmConnected ? '#e8f4ee' : 'white',
      fontSize: 11,
      cursor: 'pointer',
      color: crmConnected ? '#217346' : '#404040',
      whiteSpace: 'nowrap',
      fontWeight: crmConnected ? 600 : 400
    },
    title: "CRM"
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 12,
      height: 12,
      flexShrink: 0
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
  })), "CRM", crmConnected && /*#__PURE__*/React.createElement("span", {
    style: {
      background: '#217346',
      color: 'white',
      fontSize: 10,
      padding: '1px 5px',
      borderRadius: 8
    }
  }, crmVveCount), " ", /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 9,
      height: 9
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M19 9l-7 7-7-7"
  }))), showCrmMenu && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-10",
    onClick: () => setShowCrmMenu(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute right-0 top-full mt-1 bg-white rounded shadow-lg border border-pa-gray-200 py-1 z-20 min-w-[220px]"
  }, crmConnected ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-2 border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium text-green-600 flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 bg-green-500 rounded-full"
  }), "Verbonden"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-pa-gray-500 truncate mt-0.5"
  }, crmFileName), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-pa-gray-400"
  }, crmVveCount, " VvE's met CRM data")), /*#__PURE__*/React.createElement("button", {
    onClick: handleRefreshCrm,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
  })), "Ververs van schijf"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setCrmConnected(false);
      crmFileHandle = null;
      setShowCrmMenu(false);
    },
    className: "w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
  })), "Verbinding verbreken")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-2 text-xs text-pa-gray-500 border-b border-pa-gray-100"
  }, "Koppel een CRM bestand in de gedeelde map"), /*#__PURE__*/React.createElement("button", {
    onClick: handleConnectCrm,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
  })), "Bestaand bestand openen"), /*#__PURE__*/React.createElement("button", {
    onClick: handleNewCrmFile,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M12 4v16m8-8H4"
  })), "Nieuw CRM bestand maken"))))), dossierVisible && /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShowUserMenu(!showUserMenu);
      setShowCsvMenu(false);
      setShowCrmMenu(false);
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      border: '1px solid #d0d0d0',
      background: currentUser ? '#f0faf4' : '#fff8e1',
      fontSize: 11,
      cursor: 'pointer',
      color: currentUser ? '#217346' : '#b45309',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 11,
      height: 11,
      flexShrink: 0
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
  })), currentUser || 'Naam instellen', /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 9,
      height: 9
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M19 9l-7 7-7-7"
  }))), showUserMenu && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-10",
    onClick: () => setShowUserMenu(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute right-0 top-full mt-1 pa-card py-1 z-20 min-w-[240px]"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShowUsernameDialog(true);
      setShowUserMenu(false);
    },
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400 shrink-0",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
  })), "Gebruikersnaam wijzigen"), /*#__PURE__*/React.createElement("div", {
    className: "border-t border-pa-gray-100"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      syncDossierToFile();
      setShowUserMenu(false);
    },
    disabled: dossierSyncStatus === 'syncing',
    className: `w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${dossierSyncStatus === 'ok' ? 'text-green-700 bg-green-50' : dossierSyncStatus === 'error' ? 'text-red-700 bg-red-50' : 'text-pa-gray-700 hover:bg-blue-50'}`
  }, dossierSyncStatus === 'syncing' ? /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 shrink-0 animate-spin text-blue-500",
    fill: "none",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("circle", {
    className: "opacity-25",
    cx: "12",
    cy: "12",
    r: "10",
    stroke: "currentColor",
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("path", {
    className: "opacity-75",
    fill: "currentColor",
    d: "M4 12a8 8 0 018-8v8z"
  })) : dossierSyncStatus === 'ok' ? /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 shrink-0 text-green-500",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M5 13l4 4L19 7"
  })) : /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 shrink-0 text-blue-500",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, dossierSyncStatus === 'syncing' ? 'Bezig…' : dossierSyncStatus === 'ok' ? 'Gesynchroniseerd' : dossierDirLinked ? 'Synchroniseer naar gedeelde map' : 'Koppel gedeelde map…'), dossierLastSync && dossierSyncStatus !== 'syncing' && /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-pa-gray-400 mt-0.5"
  }, dossierLastSync.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit'
  })), !dossierDirLinked && dossierSyncStatus === 'idle' && /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-pa-gray-400 mt-0.5"
  }, "Eenmalig map aanwijzen"))), dossierDirLinked && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      ontkoppelDossierMap();
      setShowUserMenu(false);
    },
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-400 hover:text-red-500 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 shrink-0",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
  })), "Ontkoppel map"), /*#__PURE__*/React.createElement("div", {
    className: "border-t border-pa-gray-100"
  }), /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-1.5 text-[10px] text-pa-gray-400 uppercase tracking-wide"
  }, enrichmentCount, " VvE's met lokale data"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      fileInputRef.current?.click();
      setShowUserMenu(false);
    },
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
  })), "Importeer JSON"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      xlsxInputRef.current?.click();
      setShowUserMenu(false);
    },
    disabled: xlsxImportLoading,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-green-600",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M9 17v-2m3 2v-4m3 4v-6M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
  })), xlsxImportLoading ? 'Bezig…' : 'Importeer Excel'), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      exportEnrichmentData();
      setShowUserMenu(false);
    },
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
  })), "Exporteer verrijkingsdata"), enrichmentCount > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (confirm(`Weet je zeker dat je alle ${enrichmentCount} verrijkte VvE records wilt wissen?`)) {
        saveEnrichmentData({});
        setEnrichmentCount(0);
        setShowUserMenu(false);
      }
    },
    className: "w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
  })), "Wis alle data"), dossierDirLinked && (currentUser === 'hans' || currentUser === 'Hans' || currentUser === 'admin') && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "border-t border-pa-gray-100"
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      handleConsolidateEnrichment();
      setShowUserMenu(false);
    },
    className: "w-full text-left px-3 py-2 text-xs text-purple-700 hover:bg-purple-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
  })), "Consolideer bestanden")))), /*#__PURE__*/React.createElement("input", {
    ref: fileInputRef,
    type: "file",
    accept: ".json",
    onChange: handleImportData,
    className: "hidden"
  }), /*#__PURE__*/React.createElement("input", {
    ref: xlsxInputRef,
    type: "file",
    accept: ".xlsx",
    onChange: handleImportXlsx,
    className: "hidden"
  })), dossierVisible && (() => {
    var isSaving = enrichmentSaveStatus === 'saving';
    var isOk = enrichmentSaveStatus === 'ok';
    var isError = enrichmentSaveStatus === 'error';
    var needsMap = !dossierDirLinked && fsApiAvailable();
    var bg = isOk ? '#217346' : isError ? '#dc2626' : enrichmentDirty ? '#217346' : needsMap ? 'white' : '#f0faf4';
    var fg = isOk || enrichmentDirty && !isError ? 'white' : isError ? 'white' : needsMap ? '#555' : '#217346';
    var border = needsMap || !enrichmentDirty && !isOk && !isError ? '1px solid #d0d0d0' : '1px solid transparent';
    return /*#__PURE__*/React.createElement("button", {
      onClick: needsMap ? syncDossierToFile : handleSaveEnrichmentOnly,
      disabled: isSaving,
      title: needsMap ? 'Koppel de gedeelde map om verrijkingsdata op te slaan' : 'Verrijkingsdata opslaan naar de gedeelde map',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 12px',
        border,
        background: bg,
        color: fg,
        fontSize: 12,
        fontWeight: 600,
        cursor: isSaving ? 'default' : 'pointer',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        transition: 'background 0.15s'
      }
    }, isSaving ? /*#__PURE__*/React.createElement("svg", {
      style: {
        width: 13,
        height: 13
      },
      className: "animate-spin",
      fill: "none",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("circle", {
      className: "opacity-25",
      cx: "12",
      cy: "12",
      r: "10",
      stroke: "currentColor",
      strokeWidth: "4"
    }), /*#__PURE__*/React.createElement("path", {
      className: "opacity-75",
      fill: "currentColor",
      d: "M4 12a8 8 0 018-8v8z"
    })) : isOk ? /*#__PURE__*/React.createElement("svg", {
      style: {
        width: 13,
        height: 13
      },
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2.5,
      d: "M5 13l4 4L19 7"
    })) : needsMap ? /*#__PURE__*/React.createElement("svg", {
      style: {
        width: 13,
        height: 13
      },
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    })) : /*#__PURE__*/React.createElement("svg", {
      style: {
        width: 13,
        height: 13
      },
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
    })), isSaving ? 'Opslaan…' : isOk ? 'Opgeslagen' : isError ? 'Fout' : needsMap ? 'Map koppelen' : 'Opslaan');
  })(), dossierVisible && (_currentUserEnrichData.log.length > 0 || loadedUsers.length > 0) && /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowChangeLog(true),
    title: "Wijzigingslog bekijken",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: '2px 7px',
      border: '1px solid #d0d0d0',
      background: 'white',
      fontSize: 11,
      cursor: 'pointer',
      color: '#555',
      flexShrink: 0,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 11,
      height: 11
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
  })), "Log", _currentUserEnrichData.log.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      background: '#6b7280',
      color: 'white',
      padding: '0 4px',
      borderRadius: 8,
      fontWeight: 600
    }
  }, _currentUserEnrichData.log.length)))), /*#__PURE__*/React.createElement("button", {
    onClick: function() { setShowHelp(true); },
    title: "Handleiding openen",
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      border: '1px solid #d0d0d0',
      background: 'white',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
      color: '#555',
      flexShrink: 0,
      borderRadius: '50%',
      lineHeight: 1
    }
  }, "?"), showHelp && ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    onClick: function() { setShowHelp(false); },
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: 48,
      paddingBottom: 24,
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: function(e) { e.stopPropagation(); },
    style: {
      background: '#fff',
      borderRadius: 6,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      width: '90vw',
      maxWidth: 760,
      maxHeight: 'calc(100vh - 72px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#1a5c38',
      color: '#fff',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: { fontWeight: 600, fontSize: 14, flex: 1 }
  }, "Handleiding — VvE Dashboard Haarlem"), /*#__PURE__*/React.createElement("button", {
    onClick: function() { setShowHelp(false); },
    style: {
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.8)',
      cursor: 'pointer',
      fontSize: 18,
      lineHeight: 1,
      padding: '0 4px'
    }
  }, "×")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flex: 1,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      width: 180,
      flexShrink: 0,
      borderRight: '1px solid #e0e0e0',
      overflowY: 'auto',
      padding: '16px 0',
      fontSize: 12
    }
  }, [
    { label: 'Wat is het dashboard', id: 'h-wat' },
    { label: 'Navigatie', id: 'h-navigatie' },
    { label: "VvE's werkblad", id: 'h-vves' },
    { label: 'Zoeken', id: 'h-zoeken' },
    { label: 'Filteren', id: 'h-filteren' },
    { label: 'Detailpaneel', id: 'h-detail' },
    { label: 'Dakcheck', id: 'h-dakcheck' },
    { label: 'Statistieken', id: 'h-stats' },
    { label: 'Sneltoetsen', id: 'h-keys' },
    { label: 'Exporteren', id: 'h-export' },
    { label: 'Labs', id: 'h-labs' }, { label: 'Laden en versies', id: 'h-versie' }
  ].map(function(item) {
    return /*#__PURE__*/React.createElement("a", {
      key: item.id,
      href: '#' + item.id,
      onClick: function(e) {
        e.preventDefault();
        var el = document.getElementById(item.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      style: {
        display: 'block',
        padding: '4px 16px',
        color: '#4a5e52',
        textDecoration: 'none',
        borderLeft: '2px solid transparent',
        lineHeight: 1.5
      },
      onMouseEnter: function(e) {
        e.currentTarget.style.color = '#217346';
        e.currentTarget.style.borderLeftColor = '#217346';
      },
      onMouseLeave: function(e) {
        e.currentTarget.style.color = '#4a5e52';
        e.currentTarget.style.borderLeftColor = 'transparent';
      }
    }, item.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '20px 28px',
      fontSize: 13,
      lineHeight: 1.65,
      color: '#1e2620'
    }
  }, (function() {
    var H2 = function(props) {
      return /*#__PURE__*/React.createElement("h2", {
        id: props.id,
        style: {
          fontSize: 15,
          fontWeight: 700,
          color: '#1a5c38',
          borderBottom: '2px solid #e0ece4',
          paddingBottom: 6,
          marginBottom: 10,
          marginTop: props.first ? 0 : 28,
          scrollMarginTop: 12
        }
      }, props.children);
    };
    var H3 = function(props) {
      return /*#__PURE__*/React.createElement("h3", {
        style: { fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 6 }
      }, props.children);
    };
    var P = function(props) {
      return /*#__PURE__*/React.createElement("p", {
        style: { marginBottom: 8, maxWidth: '60ch' }
      }, props.children);
    };
    var Ul = function(props) {
      return /*#__PURE__*/React.createElement("ul", {
        style: { paddingLeft: '1.3em', marginBottom: 10 }
      }, props.children);
    };
    var Li = function(props) {
      return /*#__PURE__*/React.createElement("li", {
        style: { marginBottom: 3 }
      }, props.children);
    };
    var Tip = function(props) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          background: '#e8f4ee',
          borderLeft: '3px solid #217346',
          padding: '8px 12px',
          borderRadius: '0 4px 4px 0',
          marginBottom: 12,
          fontSize: 12
        }
      }, props.children);
    };
    var Kbd = function(props) {
      return /*#__PURE__*/React.createElement("kbd", {
        style: {
          display: 'inline-block',
          fontFamily: 'monospace',
          fontSize: '0.85em',
          background: '#f0f4f1',
          border: '1px solid #c4d8ca',
          borderBottomWidth: 2,
          padding: '0 5px',
          borderRadius: 3
        }
      }, props.children);
    };
    var Table = function(props) {
      return /*#__PURE__*/React.createElement("div", {
        style: { overflowX: 'auto', marginBottom: 12 }
      }, /*#__PURE__*/React.createElement("table", {
        style: { width: '100%', borderCollapse: 'collapse', fontSize: 12 }
      }, props.children));
    };
    var Th = function(props) {
      return /*#__PURE__*/React.createElement("th", {
        style: {
          textAlign: 'left',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: '#7a9082',
          borderBottom: '2px solid #e0e0e0',
          paddingBottom: 4,
          paddingRight: 12
        }
      }, props.children);
    };
    var Td = function(props) {
      return /*#__PURE__*/React.createElement("td", {
        style: {
          padding: '5px 12px 5px 0',
          borderBottom: '1px solid #f0f0f0',
          verticalAlign: 'top'
        }
      }, props.children);
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement(H2, { id: 'h-wat', first: true }, "Wat is het dashboard"),
      /*#__PURE__*/React.createElement(P, null, "Het VvE Dashboard toont alle Haarlemse VvE-adressen verdeeld over circa 4.450 VvE's. Per VvE zie je adressen, energielabels, WOZ-waarden, monumentstatus, het warmteprogramma en de dossiergegevens."),
      /*#__PURE__*/React.createElement(P, null, "Het dashboard draait volledig in de browser — er is geen login nodig en geen data wordt verstuurd naar een server."),

      /*#__PURE__*/React.createElement(H2, { id: 'h-navigatie' }, "Navigatie"),
      /*#__PURE__*/React.createElement(P, null, "Onderaan het scherm staan drie werkbladtabs:"),
      /*#__PURE__*/React.createElement(Table, null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Th, null, "Werkblad"), /*#__PURE__*/React.createElement(Th, null, "Inhoud"))),
        /*#__PURE__*/React.createElement("tbody", null,
          /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Td, null, "VvE's"), /*#__PURE__*/React.createElement(Td, null, "Lijst van alle gefilterde VvE's met detailpaneel")),
          /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Td, null, "Kaart"), /*#__PURE__*/React.createElement(Td, null, "Geografische weergave van de gefilterde selectie")),
          /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Td, null, "Statistieken"), /*#__PURE__*/React.createElement(Td, null, "Grafieken en opmerkelijke VvE's op basis van de actieve filters"))
        )
      ),

      /*#__PURE__*/React.createElement(H2, { id: 'h-vves' }, "VvE's werkblad"),
      /*#__PURE__*/React.createElement(P, null, "De lijst toont VvE's als samengevouwen groepen. Klik op een VvE-rij om hem uit te klappen en de afzonderlijke adressen te zien. Klik op een adres om het in het detailpaneel te openen."),
      /*#__PURE__*/React.createElement(P, null, "De kolom Map toont per VvE een vaste, leesbare mapnaam: eventueel de gebouwnaam, dan de hoofdstraat met huisnummers, en tussen haakjes het KvK-nummer. Heeft de VvE (nog) geen KvK-nummer, dan staat daar het 9-cijferige Kadaster-nummer. Komt er later een KvK-nummer bij, dan verandert de mapnaam mee. Klik op een mapnaam om de bijbehorende map in het VvE-dossier te openen; het kopieerknopje dat verschijnt als je eroverheen beweegt, kopieert de naam. Bestaat de map nog niet, dan kun je hem met die gekopieerde naam aanmaken."),
      /*#__PURE__*/React.createElement(P, null, "De kolom Won. telt alleen de woningen. Beweeg over het getal voor de volledige telling: niet-woonadressen (winkels, bedrijfsruimtes), overige (garageboxen, bergingen) en het aantal appartementsrechten."),
      /*#__PURE__*/React.createElement(P, null, "Het label hoofdsplitsing staat bij VvE's waar de woningen onder onderverenigingen vallen. Die onderverenigingen staan niet in de data, maar beslissen wel over de afzonderlijke woningen. Het dashboard herkent een hoofdsplitsing aan de naam, of aan veel meer woningen dan appartementsrechten; dat is een benadering, dus controleer het bij twijfel. Met het filter Hoofdsplitsing kun je ze apart bekijken."),
      /*#__PURE__*/React.createElement(Tip, null, /*#__PURE__*/React.createElement("strong", null, "Groot aantal resultaten? "), "De lijst laadt 50 VvE's tegelijk. Scroll naar beneden om meer te laden, of verfijn de zoekopdracht."),

      /*#__PURE__*/React.createElement(H2, { id: 'h-zoeken' }, "Zoeken"),
      /*#__PURE__*/React.createElement(P, null, "Gebruik de zoekbalk bovenaan om te zoeken op:"),
      /*#__PURE__*/React.createElement(Ul, null,
        /*#__PURE__*/React.createElement(Li, null, "Straatnaam of volledig adres"),
        /*#__PURE__*/React.createElement(Li, null, "Postcode (bijv. 2011 of 2011 DB)"),
        /*#__PURE__*/React.createElement(Li, null, "Naam van de VvE (statutaire naam)"),
        /*#__PURE__*/React.createElement(Li, null, "Buurt- of wijknaam"),
        /*#__PURE__*/React.createElement(Li, null, "KvK-nummer"),
        /*#__PURE__*/React.createElement(Li, null, "Nickname (uit dossier)")
      ),
      /*#__PURE__*/React.createElement(Tip, null, /*#__PURE__*/React.createElement("strong", null, "E-mail plakken: "), "Plak een e-mailadres in de zoekbalk en het dashboard zoekt automatisch op het VvE-adres uit de ondertekening."),

      /*#__PURE__*/React.createElement(H2, { id: 'h-filteren' }, "Filteren"),
      /*#__PURE__*/React.createElement(P, null, "De filterzijbalk links biedt facetfilters. Alle filters werken cumulatief (EN) en updaten de telwaarden in de andere filters in real-time."),
      /*#__PURE__*/React.createElement(H3, null, "Beschikbare filters"),
      /*#__PURE__*/React.createElement(Table, null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Th, null, "Filter"), /*#__PURE__*/React.createElement(Th, null, "Werkt op"))),
        /*#__PURE__*/React.createElement("tbody", null,
          [
            ["Grootte VvE", "Aantal adressen (1, 2–5, 6–20, 20+)"],
            ["Bouwjaar", "Bouwperiode van het pand"],
            ["Buurt", "Haarlemse buurt"],
            ["Tijdvak", "Wanneer het pand aan de beurt is in het warmteprogramma"],
            ["Warmte", "Geplande voorziening: MT, ZLT, individueel of onderzoek"],
            ["Monument", "Rijksmonument, gemeentelijk, Orde 2"],
            ["Beschermd stadsgezicht", "Ja / nee"],
            ["WOZ-waarde", "Gemiddelde WOZ per woning"],
            ["Gem. energielabel", "Gemiddeld energielabel van de VvE"],
            ["Gespikkeld", "Mix van eigenaar-bewoners en corporatiewoningen"],
            ["Adviestraject / bureau / fase", "Dossiergegevens — zie het vinkje Dossier"]
          ].map(function(row) {
            return /*#__PURE__*/React.createElement("tr", { key: row[0] }, /*#__PURE__*/React.createElement(Td, null, row[0]), /*#__PURE__*/React.createElement(Td, null, row[1]));
          })
        )
      ),
      /*#__PURE__*/React.createElement(P, null, "Klik op Wis filters (verschijnt zodra een filter actief is) om alles in één keer te resetten."),

      /*#__PURE__*/React.createElement(H3, null, "Warmte en tijdvak"),
      /*#__PURE__*/React.createElement(P, null, "Deze twee filters komen uit het warmteprogramma van de gemeente en zijn gekoppeld op pandniveau — niet op buurt. Twee VvE's in dezelfde straat kunnen dus verschillende waarden hebben."),
      /*#__PURE__*/React.createElement(Table, null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Th, null, "Warmte"), /*#__PURE__*/React.createElement(Th, null, "Betekenis"))),
        /*#__PURE__*/React.createElement("tbody", null,
          [
            ["MT", "Midden temperatuur warmtenet"],
            ["ZLT", "Zeer lage temperatuur warmtenet"],
            ["Individueel", "Individuele oplossing per woning of gebouw"],
            ["Onderzoek", "Richting is nog niet bepaald"]
          ].map(function(row) {
            return /*#__PURE__*/React.createElement("tr", { key: row[0] }, /*#__PURE__*/React.createElement(Td, null, row[0]), /*#__PURE__*/React.createElement(Td, null, row[1]));
          })
        )
      ),
      /*#__PURE__*/React.createElement(P, null, "Tijdvakken lopen van 'tussen nu en 2027' via 'tussen 2028 en 2030' en 'tussen 2030 en 2035' tot 'na 2034'. Het programma dekt alle panden in het dashboard — ook garageboxen en bergingen die bij een VvE horen."),
      /*#__PURE__*/React.createElement(Tip, null, "Beide waarden staan ook als kolom in de lijst (Warmtew. voor tijdvak, Warmte voor de voorziening) en in het detailpaneel onder Appartement."),

      /*#__PURE__*/React.createElement(H3, null, "Dossierdata tonen of verbergen"),
      /*#__PURE__*/React.createElement(P, null, "Bovenin de filterzijbalk staat het vinkje Dossier. Daarmee schakel je de dossierkolommen (Traj., Bureau, Intake, Beheerder) en de zeven dossierfilters in de lijstweergave aan of uit. Handig als je even alleen naar de basisgegevens wilt kijken."),
      /*#__PURE__*/React.createElement(Tip, null, "Zet je het vinkje uit terwijl er een dossierfilter aanstaat, dan wordt dat filter opgeheven — zo perkt een onzichtbaar filter je selectie nooit stilletjes in. De keuze wordt onthouden in je browser; het detailpaneel en de exports blijven gewoon werken."),

      /*#__PURE__*/React.createElement(H2, { id: 'h-detail' }, "Detailpaneel"),
      /*#__PURE__*/React.createElement(P, null, "Het detailpaneel heeft drie standen die je wisselt met de Details-knop of de spatiebalk:"),
      /*#__PURE__*/React.createElement(Table, null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Th, null, "Stand"), /*#__PURE__*/React.createElement(Th, null, "Omschrijving"), /*#__PURE__*/React.createElement(Th, null, "Sneltoets"))),
        /*#__PURE__*/React.createElement("tbody", null,
          /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Td, null, "Uit"), /*#__PURE__*/React.createElement(Td, null, "Paneel verborgen"), /*#__PURE__*/React.createElement(Td, null, "Spatie / Esc")),
          /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Td, null, "Splitscreen"), /*#__PURE__*/React.createElement(Td, null, "360px breed naast de lijst"), /*#__PURE__*/React.createElement(Td, null, "Spatie")),
          /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Td, null, "Volledig scherm"), /*#__PURE__*/React.createElement(Td, null, "Vult de volledige breedte"), /*#__PURE__*/React.createElement(Td, null, "Spatie"))
        )
      ),
      /*#__PURE__*/React.createElement(Tip, null, /*#__PURE__*/React.createElement(Kbd, null, "Esc"), " sluit het paneel altijd direct, ongeacht de huidige stand."),
      /*#__PURE__*/React.createElement(H3, null, "Tabs in het detailpaneel"),
      /*#__PURE__*/React.createElement(Table, null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement(Th, null, "Tab"), /*#__PURE__*/React.createElement(Th, null, "Inhoud"))),
        /*#__PURE__*/React.createElement("tbody", null,
          [
            ["VvE", "Statutaire naam, KvK-nummer, aantal eenheden, adresoverzicht"],
            ["Appartement", "Bouwjaar, WOZ-waarde, oppervlakte, energielabel, ligging"],
            ["Dossier", "Adviestraject, bureau, MWA, bestuur, notities"],
            ["Pand", "BAG-pandlinks (opent BAG-viewer)"],
            ["Dakcheck", "Dakoppervlak, daktype en 3D-model (via adresverkenner.nl)"]
          ].map(function(row) {
            return /*#__PURE__*/React.createElement("tr", { key: row[0] }, /*#__PURE__*/React.createElement(Td, null, row[0]), /*#__PURE__*/React.createElement(Td, null, row[1]));
          })
        )
      ),

      /*#__PURE__*/React.createElement(H2, { id: 'h-dakcheck' }, "Dakcheck"),
      /*#__PURE__*/React.createElement(P, null, "De Dakcheck-tab toont dakoppervlak, daktype (plat/schuin/gemengd) en een 3D-model van het geselecteerde pand, aangeleverd door adresverkenner.nl."),
      /*#__PURE__*/React.createElement(Ul, null,
        /*#__PURE__*/React.createElement(Li, null, "De tab verschijnt alleen als er BAG-pandgegevens bekend zijn."),
        /*#__PURE__*/React.createElement(Li, null, "Bij grote complexen toont de dakchecker het hele pand inclusief aangrenzende woningen."),
        /*#__PURE__*/React.createElement(Li, null, /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Kbd, null, "Esc"), " in de dakchecker sluit het detailpaneel."))
      ),

      /*#__PURE__*/React.createElement(H2, { id: 'h-stats' }, "Statistieken-werkblad"),
      /*#__PURE__*/React.createElement(P, null, "Alle grafieken berekenen op basis van de actief gefilterde selectie. Verander een filter en de statistieken updaten direct."),
      /*#__PURE__*/React.createElement(P, null, "Onderaan staan klikbare kaartjes voor uitschieters (slechtste/beste label, duurste appartement, oudste/nieuwste pand). Klik op een kaartje om direct naar die VvE te navigeren."),

      /*#__PURE__*/React.createElement(H2, { id: 'h-keys' }, "Sneltoetsen"),
      /*#__PURE__*/React.createElement("div", {
        style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 16px', marginBottom: 12, maxWidth: 420, alignItems: 'baseline', fontSize: 12 }
      },
        /*#__PURE__*/React.createElement("span", { style: { textAlign: 'right' } }, /*#__PURE__*/React.createElement(Kbd, null, "Spatie")),
        /*#__PURE__*/React.createElement("span", null, "Cycleer detailpaneel: uit → split → volledig → uit"),
        /*#__PURE__*/React.createElement("span", { style: { textAlign: 'right' } }, /*#__PURE__*/React.createElement(Kbd, null, "Esc")),
        /*#__PURE__*/React.createElement("span", null, "Sluit detailpaneel direct"),
        /*#__PURE__*/React.createElement("span", { style: { textAlign: 'right' } }, /*#__PURE__*/React.createElement(Kbd, null, "↑"), " ", /*#__PURE__*/React.createElement(Kbd, null, "↓")),
        /*#__PURE__*/React.createElement("span", null, "Navigeer door de VvE-lijst"),
        /*#__PURE__*/React.createElement("span", { style: { textAlign: 'right' } }, /*#__PURE__*/React.createElement(Kbd, null, "→")),
        /*#__PURE__*/React.createElement("span", null, "Klap geselecteerde VvE uit"),
        /*#__PURE__*/React.createElement("span", { style: { textAlign: 'right' } }, /*#__PURE__*/React.createElement(Kbd, null, "←")),
        /*#__PURE__*/React.createElement("span", null, "Klap geselecteerde VvE in")
      ),
      /*#__PURE__*/React.createElement(Tip, null, "Sneltoetsen werken niet als de cursor in een invoerveld staat."),

      /*#__PURE__*/React.createElement(H2, { id: 'h-export' }, "Exporteren"),
      /*#__PURE__*/React.createElement(P, null, "Via de Export-knop kun je de gefilterde selectie exporteren als Excel (VvE-niveau of adres-niveau)."),

      /*#__PURE__*/React.createElement(H2, { id: 'h-labs' }, "Labs-menu"),
      /*#__PURE__*/React.createElement(P, null, "Het Labs-menu (rechtsboven) bevat experimentele functies, waaronder de Herbouwwaarde-inschatting op basis van BVO, bouwlagen, bouwjaar en staat van onderhoud."),

      /*#__PURE__*/React.createElement(H2, { id: 'h-versie' }, "Laden en versies"),
      /*#__PURE__*/React.createElement(P, null, "Het dashboard bestaat uit twee delen. De gegevens staan in de map waar je het dashboard vandaan opent; de programmacode wordt bij het openen van internet opgehaald. Daardoor krijg je verbeteringen automatisch, zonder dat er bestanden gekopieerd hoeven te worden."),
      /*#__PURE__*/React.createElement(P, null, "Bij het openen zie je kort een laadscherm \u2014 bij grote bestanden kan dat een paar tellen duren. Lukt het ophalen niet, dan verschijnt een melding met een knop om het opnieuw te proberen. Je gegevens blijven in dat geval gewoon staan; alleen de programmacode ontbreekt dan even."),
      /*#__PURE__*/React.createElement(Tip, null, "Achter het buildnummer linksboven staat een 'e' wanneer de code van internet komt. Staat die er niet, dan draait er een lokale kopie. Na een verbetering kan je browser de oude versie nog tot tien minuten vasthouden \u2014 Ctrl+F5 haalt hem meteen op.")
    );
  })())))), document.body), parsedEmail && /*#__PURE__*/React.createElement(ParsedEmailCard, {
    data: parsedEmail,
    onClear: clearParsedEmail
  }), showFilters && /*#__PURE__*/React.createElement("div", {
    className: "lg:hidden fixed inset-0 z-30 bg-black bg-opacity-50",
    onClick: () => setShowFilters(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute right-0 top-0 h-full w-80 max-w-full bg-white shadow-xl overflow-y-auto",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "sticky top-0 bg-white border-b p-3 flex justify-between items-center"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "font-semibold text-pa-gray-800"
  }, "Filters"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowFilters(false),
    className: "p-1 hover:bg-pa-gray-100 rounded"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-5 h-5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mb-3 pb-3 border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-pa-gray-500 mb-2"
  }, "Toon aantallen:"), /*#__PURE__*/React.createElement("div", {
    className: "inline-flex rounded bg-pa-gray-100 p-0.5"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowVveCounts(false),
    className: `px-3 py-1 text-xs font-medium rounded-md transition-all ${!showVveCounts ? 'bg-white text-pa-gray-800 shadow-sm' : 'text-pa-gray-500 hover:text-pa-gray-700'}`
  }, "Adressen"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowVveCounts(true),
    className: `px-3 py-1 text-xs font-medium rounded-md transition-all ${showVveCounts ? 'bg-white text-pa-gray-800 shadow-sm' : 'text-pa-gray-500 hover:text-pa-gray-700'}`
  }, "VvE's")), /*#__PURE__*/React.createElement("label", {
    className: "flex items-center gap-1.5 mt-2 text-xs text-pa-gray-500 cursor-pointer select-none",
    title: "Dossierkolommen en -filters tonen of verbergen"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: showDossier,
    onChange: e => toggleDossier(e.target.checked),
    style: {
      accentColor: '#217346',
      cursor: 'pointer'
    }
  }), "Dossierdata tonen")), hasActiveFilters && /*#__PURE__*/React.createElement("div", {
    className: "mb-3 pb-2 border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      clearAllFilters();
      setShowFilters(false);
    },
    className: "text-xs text-blue-600 hover:text-blue-800 font-medium"
  }, "Wis alle filters")), /*#__PURE__*/React.createElement(FacetSection, {
    title: "KvK-nummer",
    activeCount: selectedKvk.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? sumFacet(kvkFacetCounts).vves : sumFacet(kvkFacetCounts).addresses,
    active: selectedKvk.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedKvk(new Set());
      setDisplayCount(50);
    }
  }), kvkCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: /*#__PURE__*/React.createElement("span", {
      className: "flex items-center gap-1"
    }, cat.color && /*#__PURE__*/React.createElement("span", {
      className: `inline-block w-2 h-2 rounded-full flex-shrink-0 ${cat.color === 'text-green-600' ? 'bg-green-500' : cat.color === 'text-orange-500' ? 'bg-orange-400' : cat.color === 'text-red-500' ? 'bg-red-400' : ''}`
    }), cat.label),
    count: showVveCounts ? kvkFacetCounts.vves[cat.key] || 0 : kvkFacetCounts.addresses[cat.key] || 0,
    active: selectedKvk.has(cat.key),
    onClick: () => toggleSelection(setSelectedKvk, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Grootte VvE",
    activeCount: selectedGrootte.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle groottes",
    count: showVveCounts ? sumFacet(grootteFacetCounts).vves : sumFacet(grootteFacetCounts).addresses,
    active: selectedGrootte.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedGrootte(new Set());
      setDisplayCount(50);
    }
  }), grootteCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? grootteFacetCounts.vves[cat.key] || 0 : grootteFacetCounts.addresses[cat.key] || 0,
    active: selectedGrootte.has(cat.key),
    onClick: () => toggleSelection(setSelectedGrootte, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Gemengde VvE",
    activeCount: selectedGemengd.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? sumFacet(gemengdFacetCounts).vves : sumFacet(gemengdFacetCounts).addresses,
    active: selectedGemengd.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedGemengd(new Set());
      setDisplayCount(50);
    }
  }), gemengdCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? gemengdFacetCounts.vves[cat.key] || 0 : gemengdFacetCounts.addresses[cat.key] || 0,
    active: selectedGemengd.has(cat.key),
    onClick: () => toggleSelection(setSelectedGemengd, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Hoofdsplitsing",
    activeCount: selectedHoofdsplitsing.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? sumFacet(hoofdsplitsingFacetCounts).vves : sumFacet(hoofdsplitsingFacetCounts).addresses,
    active: selectedHoofdsplitsing.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedHoofdsplitsing(new Set());
      setDisplayCount(50);
    }
  }), hoofdsplitsingCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? hoofdsplitsingFacetCounts.vves[cat.key] || 0 : hoofdsplitsingFacetCounts.addresses[cat.key] || 0,
    active: selectedHoofdsplitsing.has(cat.key),
    onClick: () => toggleSelection(setSelectedHoofdsplitsing, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Eenheidtype",
    activeCount: selectedEenheidtype.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle types",
    count: showVveCounts ? sumFacet(eenheidtypeFacetCounts).vves : sumFacet(eenheidtypeFacetCounts).addresses,
    active: selectedEenheidtype.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedEenheidtype(new Set());
      setDisplayCount(50);
    }
  }), eenheidtypeCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? eenheidtypeFacetCounts.vves[cat.key] || 0 : eenheidtypeFacetCounts.addresses[cat.key] || 0,
    active: selectedEenheidtype.has(cat.key),
    onClick: () => toggleSelection(setSelectedEenheidtype, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Bouwjaar",
    activeCount: selectedBouwjaar.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle bouwjaren",
    count: showVveCounts ? sumFacet(bouwjaarFacetCounts).vves : sumFacet(bouwjaarFacetCounts).addresses,
    active: selectedBouwjaar.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedBouwjaar(new Set());
      setDisplayCount(50);
    }
  }), bouwjaarCategories.map(cat => /*#__PURE__*/React.createElement(FacetOptionWithDesc, {
    key: cat.key,
    label: cat.label,
    desc: cat.desc,
    count: showVveCounts ? bouwjaarFacetCounts.vves[cat.key] || 0 : bouwjaarFacetCounts.addresses[cat.key] || 0,
    active: selectedBouwjaar.has(cat.key),
    onClick: () => toggleSelection(setSelectedBouwjaar, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Buurt",
    activeCount: selectedBuurt.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle buurten",
    count: showVveCounts ? buurtFacetCounts.reduce((s, b) => s + b.vves, 0) : buurtFacetCounts.reduce((s, b) => s + b.addresses, 0),
    active: selectedBuurt.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedBuurt(new Set());
      setDisplayCount(50);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "max-h-36 overflow-y-auto scrollbar-thin"
  }, buurtFacetCounts.map(item => /*#__PURE__*/React.createElement(FacetOption, {
    key: item.buurt,
    label: item.buurt,
    count: showVveCounts ? item.vves : item.addresses,
    active: selectedBuurt.has(item.buurt),
    onClick: () => toggleSelection(setSelectedBuurt, item.buurt)
  })))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Tijdvak",
    activeCount: selectedTijdvak.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle tijdvakken",
    count: showVveCounts ? sumFacet(tijdvakFacetCounts).vves : sumFacet(tijdvakFacetCounts).addresses,
    active: selectedTijdvak.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedTijdvak(new Set());
      setDisplayCount(50);
    }
  }), tijdvakCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? tijdvakFacetCounts.vves[cat.key] || 0 : tijdvakFacetCounts.addresses[cat.key] || 0,
    active: selectedTijdvak.has(cat.key),
    onClick: () => toggleSelection(setSelectedTijdvak, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Warmte",
    activeCount: selectedWarmte.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle warmtebronnen",
    count: showVveCounts ? sumFacet(warmteFacetCounts).vves : sumFacet(warmteFacetCounts).addresses,
    active: selectedWarmte.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedWarmte(new Set());
      setDisplayCount(50);
    }
  }), warmteCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? warmteFacetCounts.vves[cat.key] || 0 : warmteFacetCounts.addresses[cat.key] || 0,
    active: selectedWarmte.has(cat.key),
    onClick: () => toggleSelection(setSelectedWarmte, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Monumentstatus",
    activeCount: selectedMonument.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle statussen",
    count: showVveCounts ? sumFacet(monumentFacetCounts).vves : sumFacet(monumentFacetCounts).addresses,
    active: selectedMonument.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedMonument(new Set());
      setDisplayCount(50);
    }
  }), monumentCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? monumentFacetCounts.vves[cat.key] || 0 : monumentFacetCounts.addresses[cat.key] || 0,
    active: selectedMonument.has(cat.key),
    onClick: () => toggleSelection(setSelectedMonument, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Beschermd stadsgezicht",
    activeCount: selectedBeschermd.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle",
    count: showVveCounts ? sumFacet(beschermdFacetCounts).vves : sumFacet(beschermdFacetCounts).addresses,
    active: selectedBeschermd.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedBeschermd(new Set());
      setDisplayCount(50);
    }
  }), beschermdCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? beschermdFacetCounts.vves[cat.key] || 0 : beschermdFacetCounts.addresses[cat.key] || 0,
    active: selectedBeschermd.has(cat.key),
    onClick: () => toggleSelection(setSelectedBeschermd, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "WOZ-waarde",
    activeCount: selectedWoz.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle waarden",
    count: showVveCounts ? sumFacet(wozFacetCounts).vves : sumFacet(wozFacetCounts).addresses,
    active: selectedWoz.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedWoz(new Set());
      setDisplayCount(50);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1 px-1 pb-1"
  }, ['2024', '2025', '2026'].map(jaar => /*#__PURE__*/React.createElement("button", {
    key: jaar,
    onClick: () => { setActiveWozJaar(jaar); setSelectedWoz(new Set()); },
    className: `text-[10px] px-2 py-0.5 rounded border transition-colors ${activeWozJaar === jaar ? 'bg-pa-blue-600 text-white border-pa-blue-600 font-medium' : 'bg-white text-pa-gray-500 border-pa-gray-300 hover:border-pa-blue-400'}`
  }, jaar))), wozCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? wozFacetCounts.vves[cat.key] || 0 : wozFacetCounts.addresses[cat.key] || 0,
    active: selectedWoz.has(cat.key),
    onClick: () => toggleSelection(setSelectedWoz, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Gem. energielabel VvE",
    activeCount: selectedGemLabel.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle labels",
    count: showVveCounts ? LABEL_ORDER_FILTER.reduce(function(s,l){return s+(gemLabelFacetCounts.vves[l]||0);},0) : LABEL_ORDER_FILTER.reduce(function(s,l){return s+(gemLabelFacetCounts.addresses[l]||0);},0),
    active: selectedGemLabel.size === 0,
    isAllOption: true,
    onClick: () => { setSelectedGemLabel(new Set()); setDisplayCount(50); }
  }), LABEL_ORDER_FILTER.filter(function(label){return (showVveCounts?gemLabelFacetCounts.vves[label]:gemLabelFacetCounts.addresses[label])>0;}).map(function(label){
    var LCOLORS={'A++++':'#1a7340','A+++':'#1a7340','A++':'#217346','A+':'#2e8b57','A':'#3cb371','B':'#7ec850','C':'#d4e157','D':'#ffca28','E':'#ffa726','F':'#ef6c00','G':'#d32f2f'};
    return /*#__PURE__*/React.createElement(FacetOption,{key:label,label:/*#__PURE__*/React.createElement('span',{style:{display:'flex',alignItems:'center',gap:5}},/*#__PURE__*/React.createElement('span',{style:{display:'inline-block',width:14,height:14,borderRadius:3,flexShrink:0,background:LCOLORS[label]||'#ccc'}}),label),count:showVveCounts?gemLabelFacetCounts.vves[label]||0:gemLabelFacetCounts.addresses[label]||0,active:selectedGemLabel.has(label),onClick:()=>{toggleSelection(setSelectedGemLabel,label);setDisplayCount(50);}});
  })), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Nieuw in dataset",
    activeCount: selectedNieuw ? 1 : 0
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? countUniqueVves(applyFiltersExcept(searchFilteredData, 'nieuw')) : applyFiltersExcept(searchFilteredData, 'nieuw').length,
    active: !selectedNieuw,
    isAllOption: true,
    onClick: () => { setSelectedNieuw(false); setDisplayCount(50); }
  }), /*#__PURE__*/React.createElement(FacetOption, {
    label: "Nieuw toegevoegd",
    count: showVveCounts ? nieuwFacetCount.vves : nieuwFacetCount.addresses,
    active: selectedNieuw,
    onClick: () => { setSelectedNieuw(v => !v); setDisplayCount(50); }
  })), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Gespikkeld",
    activeCount: selectedGespikkeld.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? sumFacet(gespikkeldFacetCounts).vves : sumFacet(gespikkeldFacetCounts).addresses,
    active: selectedGespikkeld.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedGespikkeld(new Set());
      setDisplayCount(50);
    }
  }), gespikkeldCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? gespikkeldFacetCounts.vves[cat.key] || 0 : gespikkeldFacetCounts.addresses[cat.key] || 0,
    active: selectedGespikkeld.has(cat.key),
    onClick: () => toggleSelection(setSelectedGespikkeld, cat.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Aandeel corporatiewoningen",
    activeCount: selectedCorpPct.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? sumFacet(corpPctFacetCounts).vves : sumFacet(corpPctFacetCounts).addresses,
    active: selectedCorpPct.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedCorpPct(new Set());
      setDisplayCount(50);
    }
  }), corpPctCategories.map(cat => /*#__PURE__*/React.createElement(FacetOption, {
    key: cat.key,
    label: cat.label,
    count: showVveCounts ? corpPctFacetCounts.vves[cat.key] || 0 : corpPctFacetCounts.addresses[cat.key] || 0,
    active: selectedCorpPct.has(cat.key),
    onClick: () => toggleSelection(setSelectedCorpPct, cat.key)
  }))), dossierVisible && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FacetSection, {
    title: "Adviestraject",
    activeCount: selectedAdviestraject.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle trajecten",
    count: showVveCounts ? Object.values(dossierFacetCounts.adviestraject?.vves || {}).reduce((a, b) => a + b, 0) : Object.values(dossierFacetCounts.adviestraject?.addresses || {}).reduce((a, b) => a + b, 0),
    active: selectedAdviestraject.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedAdviestraject(new Set());
      setDisplayCount(50);
    }
  }), ADVIESTRAJECT_OPTIES.map(opt => /*#__PURE__*/React.createElement(FacetOption, {
    key: opt,
    label: opt,
    count: showVveCounts ? dossierFacetCounts.adviestraject?.vves?.[opt] || 0 : dossierFacetCounts.adviestraject?.addresses?.[opt] || 0,
    active: selectedAdviestraject.has(opt),
    onClick: () => toggleSelection(setSelectedAdviestraject, opt)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Bureau",
    activeCount: selectedBureau.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle bureaus",
    count: showVveCounts ? Object.values(dossierFacetCounts.bureau?.vves || {}).reduce((a, b) => a + b, 0) : Object.values(dossierFacetCounts.bureau?.addresses || {}).reduce((a, b) => a + b, 0),
    active: selectedBureau.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedBureau(new Set());
      setDisplayCount(50);
    }
  }), BUREAU_OPTIES.map(opt => /*#__PURE__*/React.createElement(FacetOption, {
    key: opt,
    label: opt,
    count: showVveCounts ? dossierFacetCounts.bureau?.vves?.[opt] || 0 : dossierFacetCounts.bureau?.addresses?.[opt] || 0,
    active: selectedBureau.has(opt),
    onClick: () => toggleSelection(setSelectedBureau, opt)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Procesbegeleider",
    activeCount: selectedProcesbegeleider.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle begeleiders",
    count: showVveCounts ? Object.values(dossierFacetCounts.procesbegeleider?.vves || {}).reduce((a, b) => a + b, 0) : Object.values(dossierFacetCounts.procesbegeleider?.addresses || {}).reduce((a, b) => a + b, 0),
    active: selectedProcesbegeleider.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedProcesbegeleider(new Set());
      setDisplayCount(50);
    }
  }), PROCESBEGELEIDER_OPTIES.map(opt => /*#__PURE__*/React.createElement(FacetOption, {
    key: opt,
    label: opt,
    count: showVveCounts ? dossierFacetCounts.procesbegeleider?.vves?.[opt] || 0 : dossierFacetCounts.procesbegeleider?.addresses?.[opt] || 0,
    active: selectedProcesbegeleider.has(opt),
    onClick: () => toggleSelection(setSelectedProcesbegeleider, opt)
  }))), [{
    key: 'intake',
    label: '1. Intake',
    sel: selectedIntake,
    set: setSelectedIntake,
    opties: INTAKE_OPTIES
  }, {
    key: 'mwa',
    label: '2. MWA',
    sel: selectedMwa,
    set: setSelectedMwa,
    opties: FASE_OPTIES
  }, {
    key: 'verdieping',
    label: '3. Verdieping',
    sel: selectedVerdieping,
    set: setSelectedVerdieping,
    opties: FASE_OPTIES
  }, {
    key: 'uitvoering',
    label: '4. Uitvoering',
    sel: selectedUitvoering,
    set: setSelectedUitvoering,
    opties: FASE_OPTIES
  }].map(({
    key,
    label,
    sel,
    set,
    opties
  }) => /*#__PURE__*/React.createElement(FacetSection, {
    key: key,
    title: label,
    activeCount: sel.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle fases",
    count: showVveCounts ? Object.values(dossierFacetCounts[key]?.vves || {}).reduce((a, b) => a + b, 0) : Object.values(dossierFacetCounts[key]?.addresses || {}).reduce((a, b) => a + b, 0),
    active: sel.size === 0,
    isAllOption: true,
    onClick: () => {
      set(new Set());
      setDisplayCount(50);
    }
  }), opties.map(opt => /*#__PURE__*/React.createElement(FacetOption, {
    key: opt,
    label: opt,
    count: showVveCounts ? dossierFacetCounts[key]?.vves?.[opt] || 0 : dossierFacetCounts[key]?.addresses?.[opt] || 0,
    active: sel.has(opt),
    onClick: () => toggleSelection(set, opt)
  })))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "hidden lg:flex",
    style: {
      width: 216,
      borderRight: '1px solid #d0d0d0',
      flexDirection: 'column',
      flexShrink: 0,
      background: 'white',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid #e0e0e0',
      padding: '5px 8px',
      background: '#f0f0f0',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: '#333'
    }
  }, "Filters"), hasActiveFilters && /*#__PURE__*/React.createElement("button", {
    onClick: clearAllFilters,
    style: {
      fontSize: 10,
      color: '#217346',
      fontWeight: 600,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: 0
    }
  }, "Wis filters")), /*#__PURE__*/React.createElement("div", {
    style: {
      borderBottom: '1px solid #e0e0e0',
      padding: '4px 8px',
      flexShrink: 0,
      background: 'white',
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: '#888',
      flexShrink: 0
    }
  }, "Toon:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      border: '1px solid #d0d0d0',
      borderRadius: 1,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowVveCounts(false),
    style: {
      padding: '1px 7px',
      fontSize: 10,
      background: !showVveCounts ? '#217346' : 'white',
      color: !showVveCounts ? 'white' : '#555',
      border: 'none',
      cursor: 'pointer'
    }
  }, "Adr."), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowVveCounts(true),
    style: {
      padding: '1px 7px',
      fontSize: 10,
      background: showVveCounts ? '#217346' : 'white',
      color: showVveCounts ? 'white' : '#555',
      border: 'none',
      cursor: 'pointer',
      borderLeft: '1px solid #d0d0d0'
    }
  }, "VvE")), /*#__PURE__*/React.createElement("label", {
    title: "Dossierkolommen en -filters tonen of verbergen",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      fontSize: 10,
      color: '#888',
      cursor: 'pointer',
      marginLeft: 'auto',
      flexShrink: 0,
      userSelect: 'none'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: showDossier,
    onChange: e => toggleDossier(e.target.checked),
    style: {
      width: 11,
      height: 11,
      margin: 0,
      accentColor: '#217346',
      cursor: 'pointer'
    }
  }), "Dossier")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '4px 6px'
    },
    className: "scrollbar-thin"
  }, /*#__PURE__*/React.createElement(FacetSection, {
    title: "KvK-nummer",
    activeCount: selectedKvk.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? sumFacet(kvkFacetCounts).vves : sumFacet(kvkFacetCounts).addresses,
    active: selectedKvk.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedKvk(new Set());
      setDisplayCount(50);
    }
  }), kvkCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: /*#__PURE__*/React.createElement("span", {
      className: "flex items-center gap-1"
    }, category.color && /*#__PURE__*/React.createElement("span", {
      className: `inline-block w-2 h-2 rounded-full flex-shrink-0 ${category.color === 'text-green-600' ? 'bg-green-500' : category.color === 'text-orange-500' ? 'bg-orange-400' : category.color === 'text-red-500' ? 'bg-red-400' : ''}`
    }), category.label),
    count: showVveCounts ? kvkFacetCounts.vves[category.key] || 0 : kvkFacetCounts.addresses[category.key] || 0,
    active: selectedKvk.has(category.key),
    onClick: () => toggleSelection(setSelectedKvk, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Grootte VvE",
    activeCount: selectedGrootte.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle groottes",
    count: showVveCounts ? sumFacet(grootteFacetCounts).vves : sumFacet(grootteFacetCounts).addresses,
    active: selectedGrootte.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedGrootte(new Set());
      setDisplayCount(50);
    }
  }), grootteCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? grootteFacetCounts.vves[category.key] || 0 : grootteFacetCounts.addresses[category.key] || 0,
    active: selectedGrootte.has(category.key),
    onClick: () => toggleSelection(setSelectedGrootte, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Gemengde VvE",
    activeCount: selectedGemengd.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? sumFacet(gemengdFacetCounts).vves : sumFacet(gemengdFacetCounts).addresses,
    active: selectedGemengd.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedGemengd(new Set());
      setDisplayCount(50);
    }
  }), gemengdCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? gemengdFacetCounts.vves[category.key] || 0 : gemengdFacetCounts.addresses[category.key] || 0,
    active: selectedGemengd.has(category.key),
    onClick: () => toggleSelection(setSelectedGemengd, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Hoofdsplitsing",
    activeCount: selectedHoofdsplitsing.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? sumFacet(hoofdsplitsingFacetCounts).vves : sumFacet(hoofdsplitsingFacetCounts).addresses,
    active: selectedHoofdsplitsing.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedHoofdsplitsing(new Set());
      setDisplayCount(50);
    }
  }), hoofdsplitsingCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? hoofdsplitsingFacetCounts.vves[category.key] || 0 : hoofdsplitsingFacetCounts.addresses[category.key] || 0,
    active: selectedHoofdsplitsing.has(category.key),
    onClick: () => toggleSelection(setSelectedHoofdsplitsing, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Eenheidtype",
    activeCount: selectedEenheidtype.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle types",
    count: showVveCounts ? sumFacet(eenheidtypeFacetCounts).vves : sumFacet(eenheidtypeFacetCounts).addresses,
    active: selectedEenheidtype.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedEenheidtype(new Set());
      setDisplayCount(50);
    }
  }), eenheidtypeCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? eenheidtypeFacetCounts.vves[category.key] || 0 : eenheidtypeFacetCounts.addresses[category.key] || 0,
    active: selectedEenheidtype.has(category.key),
    onClick: () => toggleSelection(setSelectedEenheidtype, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Bouwjaar",
    activeCount: selectedBouwjaar.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle bouwjaren",
    count: showVveCounts ? sumFacet(bouwjaarFacetCounts).vves : sumFacet(bouwjaarFacetCounts).addresses,
    active: selectedBouwjaar.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedBouwjaar(new Set());
      setDisplayCount(50);
    }
  }), bouwjaarCategories.map(category => /*#__PURE__*/React.createElement(FacetOptionWithDesc, {
    key: category.key,
    label: category.label,
    desc: category.desc,
    count: showVveCounts ? bouwjaarFacetCounts.vves[category.key] || 0 : bouwjaarFacetCounts.addresses[category.key] || 0,
    active: selectedBouwjaar.has(category.key),
    onClick: () => toggleSelection(setSelectedBouwjaar, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Buurt",
    activeCount: selectedBuurt.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle buurten",
    count: showVveCounts ? buurtFacetCounts.reduce((s, b) => s + b.vves, 0) : buurtFacetCounts.reduce((s, b) => s + b.addresses, 0),
    active: selectedBuurt.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedBuurt(new Set());
      setDisplayCount(50);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "max-h-36 overflow-y-auto scrollbar-thin"
  }, buurtFacetCounts.map(item => /*#__PURE__*/React.createElement(FacetOption, {
    key: item.buurt,
    label: item.buurt,
    count: showVveCounts ? item.vves : item.addresses,
    active: selectedBuurt.has(item.buurt),
    onClick: () => toggleSelection(setSelectedBuurt, item.buurt)
  })))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Tijdvak",
    activeCount: selectedTijdvak.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle tijdvakken",
    count: showVveCounts ? sumFacet(tijdvakFacetCounts).vves : sumFacet(tijdvakFacetCounts).addresses,
    active: selectedTijdvak.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedTijdvak(new Set());
      setDisplayCount(50);
    }
  }), tijdvakCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? tijdvakFacetCounts.vves[category.key] || 0 : tijdvakFacetCounts.addresses[category.key] || 0,
    active: selectedTijdvak.has(category.key),
    onClick: () => toggleSelection(setSelectedTijdvak, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Warmte",
    activeCount: selectedWarmte.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle warmtebronnen",
    count: showVveCounts ? sumFacet(warmteFacetCounts).vves : sumFacet(warmteFacetCounts).addresses,
    active: selectedWarmte.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedWarmte(new Set());
      setDisplayCount(50);
    }
  }), warmteCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? warmteFacetCounts.vves[category.key] || 0 : warmteFacetCounts.addresses[category.key] || 0,
    active: selectedWarmte.has(category.key),
    onClick: () => toggleSelection(setSelectedWarmte, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Monumentstatus",
    activeCount: selectedMonument.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle statussen",
    count: showVveCounts ? sumFacet(monumentFacetCounts).vves : sumFacet(monumentFacetCounts).addresses,
    active: selectedMonument.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedMonument(new Set());
      setDisplayCount(50);
    }
  }), monumentCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? monumentFacetCounts.vves[category.key] || 0 : monumentFacetCounts.addresses[category.key] || 0,
    active: selectedMonument.has(category.key),
    onClick: () => toggleSelection(setSelectedMonument, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Beschermd stadsgezicht",
    activeCount: selectedBeschermd.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle",
    count: showVveCounts ? sumFacet(beschermdFacetCounts).vves : sumFacet(beschermdFacetCounts).addresses,
    active: selectedBeschermd.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedBeschermd(new Set());
      setDisplayCount(50);
    }
  }), beschermdCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? beschermdFacetCounts.vves[category.key] || 0 : beschermdFacetCounts.addresses[category.key] || 0,
    active: selectedBeschermd.has(category.key),
    onClick: () => toggleSelection(setSelectedBeschermd, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "WOZ-waarde",
    activeCount: selectedWoz.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle waarden",
    count: showVveCounts ? sumFacet(wozFacetCounts).vves : sumFacet(wozFacetCounts).addresses,
    active: selectedWoz.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedWoz(new Set());
      setDisplayCount(50);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1 px-1 pb-1"
  }, ['2024', '2025', '2026'].map(jaar => /*#__PURE__*/React.createElement("button", {
    key: jaar,
    onClick: () => { setActiveWozJaar(jaar); setSelectedWoz(new Set()); },
    className: `text-[10px] px-2 py-0.5 rounded border transition-colors ${activeWozJaar === jaar ? 'bg-pa-blue-600 text-white border-pa-blue-600 font-medium' : 'bg-white text-pa-gray-500 border-pa-gray-300 hover:border-pa-blue-400'}`
  }, jaar))), wozCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? wozFacetCounts.vves[category.key] || 0 : wozFacetCounts.addresses[category.key] || 0,
    active: selectedWoz.has(category.key),
    onClick: () => toggleSelection(setSelectedWoz, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Gem. energielabel VvE",
    activeCount: selectedGemLabel.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle labels",
    count: showVveCounts ? LABEL_ORDER_FILTER.reduce(function(s,l){return s+(gemLabelFacetCounts.vves[l]||0);},0) : LABEL_ORDER_FILTER.reduce(function(s,l){return s+(gemLabelFacetCounts.addresses[l]||0);},0),
    active: selectedGemLabel.size === 0,
    isAllOption: true,
    onClick: () => { setSelectedGemLabel(new Set()); setDisplayCount(50); }
  }), LABEL_ORDER_FILTER.filter(function(label){return (showVveCounts?gemLabelFacetCounts.vves[label]:gemLabelFacetCounts.addresses[label])>0;}).map(function(label){
    var LCOLORS={'A++++':'#1a7340','A+++':'#1a7340','A++':'#217346','A+':'#2e8b57','A':'#3cb371','B':'#7ec850','C':'#d4e157','D':'#ffca28','E':'#ffa726','F':'#ef6c00','G':'#d32f2f'};
    return /*#__PURE__*/React.createElement(FacetOption,{key:label,label:/*#__PURE__*/React.createElement('span',{style:{display:'flex',alignItems:'center',gap:5}},/*#__PURE__*/React.createElement('span',{style:{display:'inline-block',width:14,height:14,borderRadius:3,flexShrink:0,background:LCOLORS[label]||'#ccc'}}),label),count:showVveCounts?gemLabelFacetCounts.vves[label]||0:gemLabelFacetCounts.addresses[label]||0,active:selectedGemLabel.has(label),onClick:()=>{toggleSelection(setSelectedGemLabel,label);setDisplayCount(50);}});
  })), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Nieuw in dataset",
    activeCount: selectedNieuw ? 1 : 0
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? countUniqueVves(applyFiltersExcept(searchFilteredData, 'nieuw')) : applyFiltersExcept(searchFilteredData, 'nieuw').length,
    active: !selectedNieuw,
    isAllOption: true,
    onClick: () => { setSelectedNieuw(false); setDisplayCount(50); }
  }), /*#__PURE__*/React.createElement(FacetOption, {
    label: "Nieuw toegevoegd",
    count: showVveCounts ? nieuwFacetCount.vves : nieuwFacetCount.addresses,
    active: selectedNieuw,
    onClick: () => { setSelectedNieuw(v => !v); setDisplayCount(50); }
  })), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Gespikkeld",
    activeCount: selectedGespikkeld.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? sumFacet(gespikkeldFacetCounts).vves : sumFacet(gespikkeldFacetCounts).addresses,
    active: selectedGespikkeld.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedGespikkeld(new Set());
      setDisplayCount(50);
    }
  }), gespikkeldCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? gespikkeldFacetCounts.vves[category.key] || 0 : gespikkeldFacetCounts.addresses[category.key] || 0,
    active: selectedGespikkeld.has(category.key),
    onClick: () => toggleSelection(setSelectedGespikkeld, category.key)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Aandeel corporatiewoningen",
    activeCount: selectedCorpPct.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle VvE's",
    count: showVveCounts ? sumFacet(corpPctFacetCounts).vves : sumFacet(corpPctFacetCounts).addresses,
    active: selectedCorpPct.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedCorpPct(new Set());
      setDisplayCount(50);
    }
  }), corpPctCategories.map(category => /*#__PURE__*/React.createElement(FacetOption, {
    key: category.key,
    label: category.label,
    count: showVveCounts ? corpPctFacetCounts.vves[category.key] || 0 : corpPctFacetCounts.addresses[category.key] || 0,
    active: selectedCorpPct.has(category.key),
    onClick: () => toggleSelection(setSelectedCorpPct, category.key)
  }))), dossierVisible && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FacetSection, {
    title: "Adviestraject",
    activeCount: selectedAdviestraject.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle trajecten",
    count: showVveCounts ? Object.values(dossierFacetCounts.adviestraject?.vves || {}).reduce((a, b) => a + b, 0) : Object.values(dossierFacetCounts.adviestraject?.addresses || {}).reduce((a, b) => a + b, 0),
    active: selectedAdviestraject.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedAdviestraject(new Set());
      setDisplayCount(50);
    }
  }), ADVIESTRAJECT_OPTIES.map(opt => /*#__PURE__*/React.createElement(FacetOption, {
    key: opt,
    label: opt,
    count: showVveCounts ? dossierFacetCounts.adviestraject?.vves?.[opt] || 0 : dossierFacetCounts.adviestraject?.addresses?.[opt] || 0,
    active: selectedAdviestraject.has(opt),
    onClick: () => toggleSelection(setSelectedAdviestraject, opt)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Bureau",
    activeCount: selectedBureau.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle bureaus",
    count: showVveCounts ? Object.values(dossierFacetCounts.bureau?.vves || {}).reduce((a, b) => a + b, 0) : Object.values(dossierFacetCounts.bureau?.addresses || {}).reduce((a, b) => a + b, 0),
    active: selectedBureau.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedBureau(new Set());
      setDisplayCount(50);
    }
  }), BUREAU_OPTIES.map(opt => /*#__PURE__*/React.createElement(FacetOption, {
    key: opt,
    label: opt,
    count: showVveCounts ? dossierFacetCounts.bureau?.vves?.[opt] || 0 : dossierFacetCounts.bureau?.addresses?.[opt] || 0,
    active: selectedBureau.has(opt),
    onClick: () => toggleSelection(setSelectedBureau, opt)
  }))), /*#__PURE__*/React.createElement(FacetSection, {
    title: "Procesbegeleider",
    activeCount: selectedProcesbegeleider.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle begeleiders",
    count: showVveCounts ? Object.values(dossierFacetCounts.procesbegeleider?.vves || {}).reduce((a, b) => a + b, 0) : Object.values(dossierFacetCounts.procesbegeleider?.addresses || {}).reduce((a, b) => a + b, 0),
    active: selectedProcesbegeleider.size === 0,
    isAllOption: true,
    onClick: () => {
      setSelectedProcesbegeleider(new Set());
      setDisplayCount(50);
    }
  }), PROCESBEGELEIDER_OPTIES.map(opt => /*#__PURE__*/React.createElement(FacetOption, {
    key: opt,
    label: opt,
    count: showVveCounts ? dossierFacetCounts.procesbegeleider?.vves?.[opt] || 0 : dossierFacetCounts.procesbegeleider?.addresses?.[opt] || 0,
    active: selectedProcesbegeleider.has(opt),
    onClick: () => toggleSelection(setSelectedProcesbegeleider, opt)
  }))), [{
    key: 'intake',
    label: '1. Intake',
    sel: selectedIntake,
    set: setSelectedIntake,
    opties: INTAKE_OPTIES
  }, {
    key: 'mwa',
    label: '2. MWA',
    sel: selectedMwa,
    set: setSelectedMwa,
    opties: FASE_OPTIES
  }, {
    key: 'verdieping',
    label: '3. Verdieping',
    sel: selectedVerdieping,
    set: setSelectedVerdieping,
    opties: FASE_OPTIES
  }, {
    key: 'uitvoering',
    label: '4. Uitvoering',
    sel: selectedUitvoering,
    set: setSelectedUitvoering,
    opties: FASE_OPTIES
  }].map(({
    key,
    label,
    sel,
    set,
    opties
  }) => /*#__PURE__*/React.createElement(FacetSection, {
    key: key,
    title: label,
    activeCount: sel.size
  }, /*#__PURE__*/React.createElement(FacetOption, {
    label: "Alle fases",
    count: showVveCounts ? Object.values(dossierFacetCounts[key]?.vves || {}).reduce((a, b) => a + b, 0) : Object.values(dossierFacetCounts[key]?.addresses || {}).reduce((a, b) => a + b, 0),
    active: sel.size === 0,
    isAllOption: true,
    onClick: () => {
      set(new Set());
      setDisplayCount(50);
    }
  }), opties.map(opt => /*#__PURE__*/React.createElement(FacetOption, {
    key: opt,
    label: opt,
    count: showVveCounts ? dossierFacetCounts[key]?.vves?.[opt] || 0 : dossierFacetCounts[key]?.addresses?.[opt] || 0,
    active: sel.has(opt),
    onClick: () => toggleSelection(set, opt)
  }))))))), activeSheet === 'kaart' && /*#__PURE__*/React.createElement(KaartView, {
    groups: groupedByVve
  }), activeSheet === 'statistieken' && /*#__PURE__*/React.createElement(StatistiekenView, {
    groups: groupedByVve,
    totalAddresses: totalAddressCount
  }), activeSheet === 'vves' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      borderRight: '1px solid #d0d0d0'
    }
  }, false && /*#__PURE__*/React.createElement("div", {
    className: "hidden"
  }, /*#__PURE__*/React.createElement("span", null, totalVveCount.toLocaleString(), " VvE's"), /*#__PURE__*/React.createElement("span", {
    className: "text-pa-gray-300"
  }, "|"), /*#__PURE__*/React.createElement("span", null, totalAddressCount.toLocaleString(), " adressen"), /*#__PURE__*/React.createElement("span", {
    className: "text-pa-gray-300"
  }, "|"), /*#__PURE__*/React.createElement("span", null, totalWoningenCount.toLocaleString(), " woningen"), /*#__PURE__*/React.createElement("div", {
    className: "ml-auto relative"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowCsvMenu(!showCsvMenu),
    className: "flex items-center gap-1 px-2 py-1 border border-pa-gray-300 text-pa-gray-600 hover:bg-pa-gray-50 text-xs",
    title: "Exporteer zoekresultaten"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-3.5 h-3.5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
  })), "Export", /*#__PURE__*/React.createElement("svg", {
    className: "w-3 h-3",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M19 9l-7 7-7-7"
  }))), showCsvMenu && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-10",
    onClick: () => setShowCsvMenu(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute right-0 top-full mt-1 pa-card py-1 z-20 min-w-[240px]"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: exportToXlsx,
    disabled: xlsxLoading,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, xlsxLoading ? /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-green-600 shrink-0 animate-spin",
    fill: "none",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("circle", {
    className: "opacity-25",
    cx: "12",
    cy: "12",
    r: "10",
    stroke: "currentColor",
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("path", {
    className: "opacity-75",
    fill: "currentColor",
    d: "M4 12a8 8 0 018-8v8z"
  })) : /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-green-600 shrink-0",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M9 17v-2m3 2v-4m3 4v-6M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
  })), /*#__PURE__*/React.createElement("span", {
    className: "truncate text-pa-gray-600 font-mono text-[10px]"
  }, xlsxLoading ? 'Excel genereren…' : `dashboard-data-${buildExportSlug()}.xlsx`)), /*#__PURE__*/React.createElement("button", {
    onClick: exportAddressesXlsx,
    disabled: xlsxAdressenLoading,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, xlsxAdressenLoading ? /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-green-600 shrink-0 animate-spin",
    fill: "none",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("circle", {
    className: "opacity-25",
    cx: "12",
    cy: "12",
    r: "10",
    stroke: "currentColor",
    strokeWidth: "4"
  }), /*#__PURE__*/React.createElement("path", {
    className: "opacity-75",
    fill: "currentColor",
    d: "M4 12a8 8 0 018-8v8z"
  })) : /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-green-600 shrink-0",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
  }), /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M15 11a3 3 0 11-6 0 3 3 0 016 0z"
  })), /*#__PURE__*/React.createElement("span", {
    className: "truncate text-pa-gray-600 font-mono text-[10px]"
  }, xlsxAdressenLoading ? 'Excel genereren…' : `dashboard-adressen-${buildExportSlug()}.xlsx`)), (() => {
    var _eigenIds2 = new Set(VVE_DATA.filter(d => d.kvknummer).map(d => d.vve_identificatie));
    var _enr2 = loadEnrichmentData();
    var nKvk2 = (typeof KVK_LOOKUP !== 'undefined' ? Object.keys(KVK_LOOKUP).filter(id => !_eigenIds2.has(id)).length : 0) + Object.entries(_enr2).filter(([id, e]) => e?.kvkNummer && !_eigenIds2.has(id) && !(typeof KVK_LOOKUP !== 'undefined' && KVK_LOOKUP[id])).length;
    return /*#__PURE__*/React.createElement("button", {
      onClick: () => exportKvkCsv(),
      className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2 border-t border-pa-gray-100"
    }, /*#__PURE__*/React.createElement("svg", {
      className: "w-4 h-4 text-pa-gray-400",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    })), "KvK lookup + handmatig (", nKvk2, ")");
  })(), (() => {
    var kvkCount = Object.entries(loadEnrichmentData()).filter(([id, e]) => e?.kvkNummer && !lookupKvkNummer(id)).length;
    return kvkCount > 0 ? /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        var n = exportKvkHandmatigJs();
        if (n > 0) setShowCsvMenu(false);
      },
      className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2 border-t border-pa-gray-100"
    }, /*#__PURE__*/React.createElement("svg", {
      className: "w-4 h-4 text-pa-gray-400",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
    })), "kvk_handmatig.txt (", kvkCount, ")") : null;
  })(), (() => {
    var zonKvk2 = data.reduce((s, item) => { if (!s.has(item.vve_identificatie)) s.add(item.vve_identificatie); return s; }, new Set());
    var count2 = [...zonKvk2].filter(id => { var item = data.find(d => d.vve_identificatie === id); return item && getKvkKey(item) === 'zonder_kvk'; }).length;
    return count2 > 0 ? /*#__PURE__*/React.createElement("button", {
      onClick: () => exportMissendeKvk(),
      className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2 border-t border-pa-gray-100"
    }, /*#__PURE__*/React.createElement("svg", {
      className: "w-4 h-4 text-pa-gray-400",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
    })), "VvE's zonder KvK (", count2, ")") : null;
  })(), enrichmentCount > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => exportEnrichedCsv(),
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2 border-t border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
  })), "Verrijkte VvE's (", enrichmentCount, ")"), VVE_DATA.some(d => d._verdacht) && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      exportVerdachteVves();
      setShowCsvMenu(false);
    },
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2 border-t border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-orange-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
  })), "Verdachte VvE's (22)")))), dossierVisible && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setShowUserMenu(!showUserMenu);
      setShowCsvMenu(false);
      setShowCrmMenu(false);
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      border: '1px solid #d0d0d0',
      background: currentUser ? '#f0faf4' : '#fff8e1',
      fontSize: 11,
      cursor: 'pointer',
      color: currentUser ? '#217346' : '#b45309',
      whiteSpace: 'nowrap'
    },
    title: "Gebruiker & data"
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 11,
      height: 11,
      flexShrink: 0
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
  })), currentUser || 'Naam instellen', /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 9,
      height: 9
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M19 9l-7 7-7-7"
  }))), crmEnabled && /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowCrmMenu(!showCrmMenu),
    className: `flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${crmConnected ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'bg-pa-gray-100 text-pa-gray-600 hover:bg-pa-gray-200'}`,
    title: "CRM beheren"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-3.5 h-3.5",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
  })), "CRM", crmConnected && /*#__PURE__*/React.createElement("span", {
    className: "bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full"
  }, crmVveCount), /*#__PURE__*/React.createElement("svg", {
    className: "w-3 h-3",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M19 9l-7 7-7-7"
  }))), showCrmMenu && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-10",
    onClick: () => setShowCrmMenu(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute right-0 top-full mt-1 bg-white rounded shadow-lg border border-pa-gray-200 py-1 z-20 min-w-[220px]"
  }, crmConnected ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-2 border-b border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-medium text-green-600 flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2 h-2 bg-green-500 rounded-full"
  }), "Verbonden"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-pa-gray-500 truncate mt-0.5"
  }, crmFileName), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-pa-gray-400"
  }, crmVveCount, " VvE's met CRM data")), /*#__PURE__*/React.createElement("button", {
    onClick: handleRefreshCrm,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
  })), "Ververs van schijf"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setCrmConnected(false);
      crmFileHandle = null;
      setShowCrmMenu(false);
    },
    className: "w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-pa-gray-100"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
  })), "Verbinding verbreken")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-2 text-xs text-pa-gray-500 border-b border-pa-gray-100"
  }, "Koppel een CRM bestand in de gedeelde map"), /*#__PURE__*/React.createElement("button", {
    onClick: handleConnectCrm,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
  })), "Bestaand bestand openen"), /*#__PURE__*/React.createElement("button", {
    onClick: handleNewCrmFile,
    className: "w-full text-left px-3 py-2 text-xs text-pa-gray-700 hover:bg-pa-gray-50 flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "w-4 h-4 text-pa-gray-400",
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M12 4v16m8-8H4"
  })), "Nieuw CRM bestand maken")))))), totalVveCount === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: '#888',
      fontSize: 13
    }
  }, "Geen resultaten gevonden"), hasActiveFilters && /*#__PURE__*/React.createElement("button", {
    onClick: clearAllFilters,
    style: {
      marginTop: 8,
      fontSize: 12,
      color: '#0078d4',
      background: 'none',
      border: 'none',
      cursor: 'pointer'
    }
  }, "Wis filters"))) : /*#__PURE__*/React.createElement("div", {
    ref: listContainerRef,
    style: {
      flex: 1,
      overflow: 'auto'
    },
    className: "scrollbar-thin"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 10,
      minWidth: xlMinWidth
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: xlColTemplate,
      background: '#ececec',
      borderBottom: '1px solid #ccc'
    }
  }, xlColLabels.map((label, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      borderRight: i < xlColLabels.length - 1 ? '1px solid #d0d0d0' : 'none',
      background: i === 0 ? '#e0e0e0' : '#ececec',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2px 4px',
      fontSize: 11,
      fontWeight: 500,
      color: '#555',
      userSelect: 'none',
      height: 18
    }
  }, i > 0 ? String.fromCharCode(64 + i) : ''))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: xlColTemplate,
      background: '#f0f0f0',
      borderBottom: '2px solid #bbb'
    }
  }, xlColLabels.map((label, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '3px 6px',
      fontSize: 10,
      fontWeight: 600,
      color: '#333',
      borderRight: i < xlColLabels.length - 1 ? '1px solid #ccc' : 'none',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      background: i === 0 ? '#e0e0e0' : '#f0f0f0'
    },
    title: label === 'Won.' ? 'Aantal woningen (woonadressen) in de VvE. Garages, bergingen en bedrijfsruimtes tellen niet mee; beweeg over een getal voor de volledige telling.' : undefined
  }, label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: xlMinWidth
    }
  }, displayedVveGroups.map((group, index) => /*#__PURE__*/React.createElement(VveGroupCard, {
    key: group.vve.vve_identificatie,
    vve: group.vve,
    addresses: group.addresses,
    onSelectItem: handleSelectItem,
    selectedItem: selectedItem,
    isExpanded: expandedVves.has(group.vve.vve_identificatie),
    onToggleExpand: toggleVveExpanded,
    crmConnected: crmEnabled && crmConnected,
    rowIndex: index + 1,
    colTemplate: xlColTemplate,
    dossierVisible: dossierVisible,
    gespikkeldLookup: gespikkeldLookup,
    activeWozJaar: activeWozJaar
  })), /*#__PURE__*/React.createElement("div", {
    ref: sentinelRef,
    style: {
      height: 1
    }
  }), (() => {
    var ROW_H = 22;
    var HEADER_H = 36;
    var approxDataH = displayedVveGroups.length * ROW_H + HEADER_H;
    var count = Math.max(1, Math.ceil((listContainerHeight - approxDataH) / ROW_H) + 1);
    var startRow = displayedVveGroups.length + 1;
    return Array.from({
      length: count
    }, (_, i) => /*#__PURE__*/React.createElement("div", {
      key: `ph-${i}`,
      style: {
        display: 'grid',
        gridTemplateColumns: xlColTemplate,
        borderBottom: '1px dashed #ebebeb',
        background: 'white',
        minHeight: ROW_H
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#efefef',
        borderRight: '1px solid #d0d0d0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 6px',
        fontSize: 10,
        color: '#ccc',
        userSelect: 'none'
      }
    }, startRow + i), xlColLabels.slice(1).map((_, j) => /*#__PURE__*/React.createElement("div", {
      key: j,
      style: {
        borderRight: j < xlColLabels.length - 2 ? '1px dashed #ebebeb' : 'none'
      }
    }))));
  })()))), /*#__PURE__*/React.createElement("div", {
    className: "hidden lg:flex",
    style: {
      width: showDetailPanelDesktop === 'split' ? 360 : showDetailPanelDesktop === 'full' ? 9999 : 0,
      flexShrink: showDetailPanelDesktop === 'full' ? 1 : 0,
      flexGrow: showDetailPanelDesktop === 'full' ? 1 : 0,
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'white',
      borderLeft: showDetailPanelDesktop !== 'hidden' ? '1px solid #d0d0d0' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    },
    className: "scrollbar-thin"
  }, selectedItem ? /*#__PURE__*/React.createElement(DetailPanel, {
    item: selectedItem,
    vveAddresses: vveAddresses,
    onClose: () => setSelectedItem(null),
    onEnrichmentChange: handleEnrichmentChange,
    crmConnected: crmEnabled && crmConnected,
    onCrmUpdate: handleCrmUpdate,
    dossierVisible: dossierVisible,
    gespikkeldLookup: gespikkeldLookup,
    activeWozJaar: activeWozJaar,
    onSelectVve: handleSelectItem
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      textAlign: 'center',
      color: '#aaa',
      fontSize: 12,
      marginTop: 40
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 32,
      height: 32,
      margin: '0 auto 8px',
      opacity: 0.3
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.5,
    d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
  })), /*#__PURE__*/React.createElement("p", null, "Selecteer een VvE of adres"))))) /* end activeSheet === 'vves' */, selectedItem && (() => {
    var sortedVveAddr = [...vveAddresses].sort((a, b) => {
      var nA = parseInt(a.huisnummer) || 0,
        nB = parseInt(b.huisnummer) || 0;
      if (nA !== nB) return nA - nB;
      return (a.huislettertoevoeging || '').localeCompare(b.huislettertoevoeging || '');
    });
    var curIdx = sortedVveAddr.findIndex(a => a.id === selectedItem.id);
    var prevItem = curIdx > 0 ? sortedVveAddr[curIdx - 1] : null;
    var nextItem = curIdx < sortedVveAddr.length - 1 ? sortedVveAddr[curIdx + 1] : null;
    return /*#__PURE__*/React.createElement("div", {
      className: "lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50",
      onClick: () => setSelectedItem(null)
    }, /*#__PURE__*/React.createElement("div", {
      className: "absolute inset-x-0 bottom-0 top-12 bg-white flex flex-col",
      onClick: e => e.stopPropagation(),
      onTouchStart: e => {
        e.currentTarget._touchStartX = e.touches[0].clientX;
        e.currentTarget._touchStartY = e.touches[0].clientY;
      },
      onTouchEnd: e => {
        var dx = e.changedTouches[0].clientX - (e.currentTarget._touchStartX || 0);
        var dy = e.changedTouches[0].clientY - (e.currentTarget._touchStartY || 0);
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          if (dx < 0 && nextItem) setSelectedItem(nextItem);
          if (dx > 0 && prevItem) setSelectedItem(prevItem);
        }
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center justify-between px-3 py-2 border-b border-pa-gray-200 bg-pa-gray-50 shrink-0"
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => prevItem && setSelectedItem(prevItem),
      disabled: !prevItem,
      className: `flex items-center gap-1 px-2 py-1 text-xs rounded ${prevItem ? 'hover:bg-pa-gray-100' : 'text-pa-gray-300'}`
    }, /*#__PURE__*/React.createElement("svg", {
      className: "w-4 h-4",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M15 19l-7-7 7-7"
    })), "Vorige"), /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-pa-gray-500"
    }, curIdx + 1, " / ", sortedVveAddr.length), /*#__PURE__*/React.createElement("button", {
      onClick: () => nextItem && setSelectedItem(nextItem),
      disabled: !nextItem,
      className: `flex items-center gap-1 px-2 py-1 text-xs rounded ${nextItem ? 'hover:bg-pa-gray-100' : 'text-pa-gray-300'}`
    }, "Volgende", /*#__PURE__*/React.createElement("svg", {
      className: "w-4 h-4",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M9 5l7 7-7 7"
    })))), /*#__PURE__*/React.createElement("div", {
      className: "flex-1 overflow-y-auto relative"
    }, prevItem && /*#__PURE__*/React.createElement("div", {
      className: "absolute left-0 top-12 bottom-0 w-8 z-10 cursor-pointer",
      onClick: () => setSelectedItem(prevItem)
    }), nextItem && /*#__PURE__*/React.createElement("div", {
      className: "absolute right-0 top-12 bottom-0 w-8 z-10 cursor-pointer",
      onClick: () => setSelectedItem(nextItem)
    }), /*#__PURE__*/React.createElement(DetailPanel, {
      item: selectedItem,
      vveAddresses: vveAddresses,
      onClose: () => setSelectedItem(null),
      onEnrichmentChange: handleEnrichmentChange,
      crmConnected: crmEnabled && crmConnected,
      onCrmUpdate: handleCrmUpdate,
      dossierVisible: dossierVisible,
      gespikkeldLookup: gespikkeldLookup,
      showToolbarPortal: false,
      activeWozJaar: activeWozJaar
    }))));
  })()), showUsernameDialog && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 9000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)'
    },
    onClick: () => currentUser && setShowUsernameDialog(false)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'white',
      border: '1px solid #d0d0d0',
      maxWidth: 360,
      width: '100%',
      margin: '0 16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#217346',
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'white'
    }
  }, "Jouw naam instellen"), currentUser && /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowUsernameDialog(false),
    style: {
      background: 'none',
      border: 'none',
      color: 'white',
      cursor: 'pointer',
      padding: 2,
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    style: {
      width: 14,
      height: 14
    },
    fill: "none",
    stroke: "currentColor",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React.createElement("path", {
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "M6 18L18 6M6 6l12 12"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 16px 8px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'block',
      fontSize: 12,
      fontWeight: 500,
      color: '#444',
      marginBottom: 6
    }
  }, "Jouw naam (voor verrijkingsdata)"), /*#__PURE__*/React.createElement("input", {
    type: "text",
    defaultValue: currentUser,
    autoFocus: true,
    id: "usernameInput",
    placeholder: typeof GEBRUIKER_PLACEHOLDER !== 'undefined' ? GEBRUIKER_PLACEHOLDER : 'Je voornaam',
    onKeyDown: e => {
      if (e.key === 'Enter') {
        var val = e.target.value.trim();
        if (!val) return;
        localStorage.setItem('vve_dashboard_username', val);
        setCurrentUser(val);
        setShowUsernameDialog(false);
        if (!dossierDirLinked && fsApiAvailable()) syncDossierToFile();
      }
    },
    style: {
      width: '100%',
      padding: '6px 10px',
      border: '1px solid #c0c0c0',
      fontSize: 13,
      outline: 'none',
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      color: '#888',
      marginTop: 5,
      lineHeight: 1.4
    }
  }, "Wordt gebruikt om jouw wijzigingen bij te houden.", !dossierDirLinked && fsApiAvailable() && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#217346',
      fontWeight: 500
    }
  }, "Daarna vragen we je de gedeelde map te selecteren.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 16px 16px',
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8
    }
  }, currentUser && /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowUsernameDialog(false),
    style: {
      padding: '5px 14px',
      fontSize: 12,
      border: '1px solid #d0d0d0',
      background: 'white',
      cursor: 'pointer',
      color: '#555'
    }
  }, "Annuleren"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      var val = (document.getElementById('usernameInput')?.value || '').trim();
      if (!val) return;
      localStorage.setItem('vve_dashboard_username', val);
      setCurrentUser(val);
      setShowUsernameDialog(false);
      if (!dossierDirLinked && fsApiAvailable()) syncDossierToFile();
    },
    style: {
      padding: '5px 14px',
      fontSize: 12,
      background: '#217346',
      color: 'white',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600
    }
  }, dossierDirLinked || !fsApiAvailable() ? 'Opslaan' : 'Opslaan & map koppelen →')))), showChangeLog && (() => {
    var log = [..._currentUserEnrichData.log].sort((a, b) => b.ts - a.ts);
    var fmtTs = ts => new Date(ts).toLocaleString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    var truncate = (s, n = 28) => s && s.length > n ? s.slice(0, n) + '…' : s || '';
    var exportLogCsv = () => {
      var header = 'Datum/tijd;Gebruiker;VvE;Veld;Oud;Nieuw';
      var rows = log.map(e => [fmtTs(e.ts), e.user || '', `"${(e.vve_naam || '').replace(/"/g, '""')}"`, e.field || '', `"${(e.old || '').replace(/"/g, '""')}"`, `"${(e.new || '').replace(/"/g, '""')}"`].join(';'));
      var csv = [header, ...rows].join('\n');
      var blob = new Blob(['﻿' + csv], {
        type: 'text/csv;charset=utf-8;'
      });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = `enrichment_log_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 60,
        background: 'rgba(0,0,0,0.4)'
      },
      onClick: () => setShowChangeLog(false)
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'white',
        border: '1px solid #d0d0d0',
        maxWidth: 820,
        width: '100%',
        margin: '0 16px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#217346',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: 'white'
      }
    }, "Wijzigingslog (", log.length, ")"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'center'
      }
    }, log.length > 0 && /*#__PURE__*/React.createElement("button", {
      onClick: exportLogCsv,
      style: {
        padding: '2px 10px',
        fontSize: 11,
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.4)',
        color: 'white',
        cursor: 'pointer',
        borderRadius: 2
      }
    }, "Exporteer CSV"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setShowChangeLog(false),
      style: {
        background: 'none',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        padding: 2,
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement("svg", {
      style: {
        width: 14,
        height: 14
      },
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24"
    }, /*#__PURE__*/React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      d: "M6 18L18 6M6 6l12 12"
    }))))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        padding: '4px 0'
      }
    }, log.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 24,
        textAlign: 'center',
        color: '#aaa',
        fontSize: 12
      }
    }, "Nog geen wijzigingen geregistreerd in deze sessie.") : /*#__PURE__*/React.createElement("table", {
      style: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement("thead", {
      style: {
        position: 'sticky',
        top: 0,
        background: '#f5f5f5',
        zIndex: 1
      }
    }, /*#__PURE__*/React.createElement("tr", {
      style: {
        borderBottom: '2px solid #d0d0d0'
      }
    }, ['Datum/tijd', 'Gebruiker', 'VvE', 'Veld', 'Oud', 'Nieuw'].map(h => /*#__PURE__*/React.createElement("th", {
      key: h,
      style: {
        padding: '4px 8px',
        textAlign: 'left',
        fontWeight: 600,
        fontSize: 10,
        color: '#555',
        whiteSpace: 'nowrap'
      }
    }, h)))), /*#__PURE__*/React.createElement("tbody", null, log.map((entry, i) => /*#__PURE__*/React.createElement("tr", {
      key: i,
      style: {
        borderBottom: '1px solid #ebebeb',
        background: i % 2 === 0 ? 'white' : '#fafafa'
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '3px 8px',
        whiteSpace: 'nowrap',
        color: '#777'
      }
    }, fmtTs(entry.ts)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '3px 8px',
        whiteSpace: 'nowrap',
        fontWeight: 500,
        color: '#217346'
      }
    }, entry.user || ''), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '3px 8px',
        color: '#333'
      },
      title: entry.vve_naam || ''
    }, truncate(entry.vve_naam || entry.vve_id)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '3px 8px',
        fontFamily: 'monospace',
        fontSize: 10,
        color: '#555'
      }
    }, entry.field), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '3px 8px',
        color: '#dc2626',
        maxWidth: 140,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      },
      title: entry.old || ''
    }, truncate(entry.old, 20) || /*#__PURE__*/React.createElement("span", {
      style: {
        color: '#ccc'
      }
    }, "—")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '3px 8px',
        color: '#217346',
        maxWidth: 140,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      },
      title: entry.new || ''
    }, truncate(entry.new, 20) || /*#__PURE__*/React.createElement("span", {
      style: {
        color: '#ccc'
      }
    }, "—")))))))));
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#217346',
      color: 'white',
      fontSize: 10,
      padding: '2px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500
    }
  }, totalVveCount.toLocaleString(), " VvE's"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.4
    }
  }, "·"), /*#__PURE__*/React.createElement("span", null, totalAddressCount.toLocaleString(), " adressen"), hasActiveFilters && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.4
    }
  }, "·"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#ffd700',
      fontWeight: 600
    }
  }, "Filters actief")), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      opacity: 0.65
    }
  }, "Haarlem · ", data.length.toLocaleString(), " adressen totaal")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#d8d8d8',
      borderTop: '1px solid #bbb',
      display: 'flex',
      alignItems: 'stretch',
      height: 23,
      flexShrink: 0
    }
  }, [['vves', "VvE's"], ['kaart', 'Kaart'], ['statistieken', 'Statistieken']].map(([key, label]) => /*#__PURE__*/React.createElement("div", {
    key: key,
    onClick: () => setActiveSheet(key),
    style: {
      padding: '0 14px',
      fontSize: 11,
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      userSelect: 'none',
      background: activeSheet === key ? 'white' : 'transparent',
      color: activeSheet === key ? '#222' : '#666',
      fontWeight: activeSheet === key ? 500 : 400,
      borderRight: '1px solid #bbb',
      borderTop: activeSheet === key ? '2px solid #217346' : '2px solid transparent'
    }
  }, label))));
};
ReactDOM.createRoot(document.getElementById('app')).render(/*#__PURE__*/React.createElement(App, null));
