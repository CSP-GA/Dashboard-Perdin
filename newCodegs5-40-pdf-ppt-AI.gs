/**
 * PII EXECUTIVE DASHBOARD - BACKEND LOGIC
 * v5.9 - Emisi Kend Dinas/Pribadi + Deteksi USD/IDR
 */

// ─── KOORDINAT JAKARTA ────────────────────────────────────────────────────────
var JAKARTA_LAT = -6.2088;
var JAKARTA_LNG = 106.8456;

// ─── FAKTOR EMISI (kg CO2 per km) ────────────────────────────────────────────
var EMISSION_FACTOR = {
  'Pesawat'      : 0.255,
  'Kereta Api'   : 0.041,
  'Whoosh - KCIC': 0.006,
  'Bus / Travel' : 0.089,
  'Kend Dinas'   : 0.167,
  'Kend Pribadi' : 0.167
};

// ─── DAFTAR NEGARA LUAR (untuk deteksi USD) ───────────────────────────────────
var NEGARA_LUAR = [
  'Brunei Darussalam','Armenia','Kamboja','Flipina','Singapura','Thailand',
  'Timor Leste','Laos','Vietnam','Malaysia','Myanmar','China','Hong Kong',
  'Makau','Taiwan','Jepang','Korea Selatan','Korea Utara','Mongolia',
  'Bangladesh','Bhutan','India','Maladewa','Nepal','Pakistan','Sri Langka',
  'Afghanistan','Arab Saudi','Azerbaijan','Bahrain','Kuwait','Oman','Qatar',
  'Uni Emirat Arab','Yaman','Palestina','Irak','Israel','Lebanon','Turki',
  'Suriah','Yordania','Iran','Siprus','Kazkhstan','Kirgizhtan','Tajikistan',
  'Turkmenistan','Uzbekistan','Aljazair','Libya','Mesir','Moroko','Sudan',
  'Tunisia','Afrika Selatan','Botswana','Lesotho','Namibia','Swaziland',
  'Angola','Chad','Gabon','Guinea Khatulistiwa','Kamerun','Kongo',
  'Republik Afrika Tengah','Republik Demokratik Kongo','Burundi','Djibouti',
  'Eritrea','Ethiopia','Kenya','Komoro','Madagaskar','Malawi','Mauritius',
  'Mozambik','Rwanda','Seychelles','Somalia','Sudan Selatan','Tanzania',
  'Uganda','Zambia','Zimbabwe','Benin','Burkina Faso','Gambia','Ghana',
  'Guinea','Guinea Bissau','Liberia','Mali','Mauritania','Nigeria',
  'Pantai Gading','Senegal','Sierra Leone','Tanjung Verde','Togo',
  'Albania','Andorra','Austria','Belanda','Belarus','Belgia',
  'Bosnia dan Herzegovina','Bulgaria','Kroasia','Ceko','Denmark','Estonia',
  'Finlandia','Prancis','Georgia','Jerman','Yunani','Hungaria','Islandia',
  'Italia','Kazakhstan','Latvia','Liechtenstein','Lituania','Luksemburg',
  'Makedonia Utara','Malta','Moldova','Monako','Montenegro','Norwegia',
  'Polandia','Portugal','Rumania','Rusia','San Marino','Serbia','Slowakia',
  'Slovenia','Spanyol','Swedia','Swiss','Ukraina','Britania Raya','Vatikan',
  'Amerika Serikat','Kanada','Brasil','Argentina','Chili','Ekuador',
  'Bolivia','Kolombia','Paraguay','Peru','Suriname','Uruguay','Venezuela',
  'Guyana','Australia','Selandia Baru'
];

// ─── CEK APAKAH KOTA LUAR NEGERI ─────────────────────────────────────────────
function isLuarNegeri(kotaTujuan) {
  var kota = String(kotaTujuan || '').trim().toLowerCase();
  for (var i = 0; i < NEGARA_LUAR.length; i++) {
    if (kota === NEGARA_LUAR[i].toLowerCase()) return true;
  }
  return false;
}

// ─── HAVERSINE ────────────────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  if (!lat2 || !lng2) return 0;
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2)
        + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)
        * Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── PARSE ANGKA ──────────────────────────────────────────────────────────────
function parseAngka(val) {
  if (typeof val === 'number') return val;
  return parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
}

// ─── LOAD REF_KOTA ────────────────────────────────────────────────────────────
function loadRefKota(ss) {
  var sheet = ss.getSheetByName('Ref_Kota');
  if (!sheet) { Logger.log('Ref_Kota not found'); return {}; }

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return {};

  var headers = data[0];
  var iNama = 0, iLat = 1, iLng = 2;
  headers.forEach(function(h, i) {
    var key = String(h).toLowerCase().trim();
    if (key.includes('kota') || key.includes('negara') || key.includes('nama')) iNama = i;
    if (key === 'lintang' || key.includes('lat')) iLat = i;
    if (key === 'bujur' || key === 'lng' || key === 'lon' || key.includes('bujur')) iLng = i;
  });

  var refMap = {};
  data.slice(1).forEach(function(row) {
    var nama = String(row[iNama] || '').trim();
    if (!nama) return;
    var lat = parseAngka(row[iLat]);
    var lng = parseAngka(row[iLng]);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      refMap[nama]               = { lat: lat, lng: lng };
      refMap[nama.toLowerCase()] = { lat: lat, lng: lng };
    }
  });

  Logger.log('Ref_Kota loaded: ' + Object.keys(refMap).length / 2 + ' kota');
  return refMap;
}

// ─── HITUNG EMISI SATU ARAH ───────────────────────────────────────────────────
function hitungEmisi(jarakKm, moda) {
  var faktor = EMISSION_FACTOR[moda] || 0;
  return jarakKm * faktor;
}

// ─── doGet ────────────────────────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('PII Executive Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

// ─── HITUNG LEAD TIME STATUS ──────────────────────────────────────────────────
// Return: { value: N, status: 'normal'|'info'|'mepet'|'sangat_mepet' }
function hitungLeadTimeStatus(tglSubmit, tglBerangkat) {
  var JAM_MULAI   = 8;
  var JAM_SELESAI = 17;

  var submitDate    = new Date(tglSubmit.getFullYear(),    tglSubmit.getMonth(),    tglSubmit.getDate());
  var berangkatDate = new Date(tglBerangkat.getFullYear(), tglBerangkat.getMonth(), tglBerangkat.getDate());
  var hariSama      = submitDate.getTime() === berangkatDate.getTime();

  if (hariSama) return { value: 0, status: 'sangat_mepet' };

  var hariSubmit     = tglSubmit.getDay();
  var jamSubmit      = tglSubmit.getHours() + tglSubmit.getMinutes() / 60;
  var diLuarJamKerja = (hariSubmit === 0 || hariSubmit === 6) ||
                       (jamSubmit < JAM_MULAI || jamSubmit >= JAM_SELESAI);

  var cur = new Date(submitDate.getTime());
  cur.setDate(cur.getDate() + 1);
  var hariKerjaTersisa = 0;
  while (cur < berangkatDate) {
    var hari = cur.getDay();
    if (hari !== 0 && hari !== 6) hariKerjaTersisa++;
    cur.setDate(cur.getDate() + 1);
  }
  var hariBerangkat = berangkatDate.getDay();
  if (hariBerangkat !== 0 && hariBerangkat !== 6) hariKerjaTersisa++;

  var selisihHari = Math.round((berangkatDate - submitDate) / (1000 * 60 * 60 * 24));

  if (diLuarJamKerja) {
    if (hariKerjaTersisa === 0) return { value: selisihHari, status: 'mepet' };
    return { value: selisihHari, status: 'info' };
  }

  return { value: selisihHari, status: 'normal' };
}

// Wrapper backward compatibility
function hitungJamKerjaTersisa(tglSubmit, tglBerangkat) {
  return hitungLeadTimeStatus(tglSubmit, tglBerangkat).value;
}

// ─── getSheetData ─────────────────────────────────────────────────────────────
function getSheetData() {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var sheet   = ss.getSheetByName('Data');
    var refKota = loadRefKota(ss);

    if (!sheet) throw new Error("Sheet 'Data' tidak ditemukan.");

    var data    = sheet.getDataRange().getValues();
    var headers = data[0];
    var rows    = data.slice(1);

    var finalData = rows.map(function(row) {
      var d = {};
      headers.forEach(function(h, i) { d[h] = row[i]; });

      var tglBerangkat = new Date(d['Arrival']);
      var tglPulang    = new Date(d['Departure']);
      var tglSubmit    = new Date(d['Tanggal Submit']);
      var tglApprove   = new Date(d['Tanggal Approve']);
      var msPerDay     = 1000 * 60 * 60 * 24;

      // Durasi
      var durasiDays = 0;
      if (!isNaN(tglPulang) && !isNaN(tglBerangkat)) {
        var dateBerangkat = new Date(tglBerangkat.getFullYear(), tglBerangkat.getMonth(), tglBerangkat.getDate());
        var datePulang    = new Date(tglPulang.getFullYear(),    tglPulang.getMonth(),    tglPulang.getDate());
        durasiDays = Math.max(0, Math.round((datePulang - dateBerangkat) / msPerDay));
        if (durasiDays === 0) durasiDays = 1;
      }

      // Lead Time
      var leadTimeDays = 0;
      if (!isNaN(tglBerangkat) && !isNaN(tglSubmit)) {
        leadTimeDays = hitungJamKerjaTersisa(tglSubmit, tglBerangkat);
      }

      // SLA Approve
      var slaDays    = 0;
      var slaAnomali = false;
      if (!isNaN(tglApprove) && !isNaN(tglSubmit)) {
        var diffMs = tglApprove.getTime() - tglSubmit.getTime();
        if (diffMs >= 0) {
          slaDays = Math.round(diffMs / msPerDay * 10000) / 10000;
        } else {
          slaAnomali = true;
          Logger.log('ANOMALI - Approve sebelum Submit: ' + (d['Nama Karyawan'] || '?'));
        }
      }

      // Mata Uang
      var kotaTujuan   = String(d['Kota Tujuan'] || '').trim();
      var isLN         = isLuarNegeri(kotaTujuan);
      var nilaiUPD     = parseFloat(d['UPD']) || 0;
      var nilaiTrans   = parseFloat(d['Biaya Transport']) || 0;
      var totalBiayaIDR = isLN ? nilaiTrans : nilaiUPD + nilaiTrans;
      var totalBiayaUSD = isLN ? nilaiUPD   : 0;

      // Koordinat
      var ref     = refKota[kotaTujuan] || refKota[kotaTujuan.toLowerCase()];
      var kotaLat = ref ? ref.lat : null;
      var kotaLng = ref ? ref.lng : null;

      if (!ref && kotaTujuan) {
        var kotaKey = kotaTujuan.toLowerCase();
        var keys    = Object.keys(refKota);
        for (var k = 0; k < keys.length; k++) {
          if (keys[k].indexOf(kotaKey) >= 0 || kotaKey.indexOf(keys[k]) >= 0) {
            ref     = refKota[keys[k]];
            kotaLat = ref.lat;
            kotaLng = ref.lng;
            break;
          }
        }
      }
      if (!kotaLat || !kotaLng) { kotaLat = null; kotaLng = null; }

      // Jarak & Emisi
      var jarakKm        = kotaLat ? haversineKm(JAKARTA_LAT, JAKARTA_LNG, kotaLat, kotaLng) : 0;
      var modaBerangkat  = String(d['Transportasi Berangkat'] || '').trim();
      var modaPulang     = String(d['Transportasi Pulang']    || '').trim();
      var emisiBerangkat = hitungEmisi(jarakKm, modaBerangkat);
      var emisiPulang    = hitungEmisi(jarakKm, modaPulang);
      var totalEmisi     = emisiBerangkat + emisiPulang;

      return {
        'Nama'          : d['Nama Karyawan']     || 'Unknown',
        'Divisi'        : d['Divisi']            || 'N/A',
        'Kota'          : kotaTujuan             || 'N/A',
        'Tujuan'        : d['Tujuan Perjalanan'] || '-',
        'Approver'      : String(d['Approval']   || '').trim(),
        'TglSubmit'     : !isNaN(tglSubmit)    ? tglSubmit.getTime()    : null,
        'TglApprove'    : !isNaN(tglApprove)   ? tglApprove.getTime()   : null,
        'ModaBerangkat' : modaBerangkat,
        'ModaPulang'    : modaPulang,
        'Arrival'       : !isNaN(tglBerangkat) ? tglBerangkat.getTime() : null,
        'Departure'     : !isNaN(tglPulang)    ? tglPulang.getTime()    : null,
        'BiayaIDR'      : totalBiayaIDR,
        'BiayaUSD'      : totalBiayaUSD,
        'UPD'           : nilaiUPD,
        'MataUang'      : isLN ? 'USD' : 'IDR',
        'IsLuarNegeri'  : isLN,
        'Durasi'        : durasiDays,
        'LeadTime'      : leadTimeDays,
        'LeadStatus'    : (!isNaN(tglSubmit) && !isNaN(tglBerangkat))
                            ? hitungLeadTimeStatus(tglSubmit, tglBerangkat).status
                            : 'normal',
        'SLA'           : slaDays,
        'SLAAnomali'    : slaAnomali,
        'Lat'           : kotaLat,
        'Lng'           : kotaLng,
        'Jarak'         : Math.round(jarakKm),
        'Emisi'         : parseFloat(totalEmisi.toFixed(2)),
        'EmisiBerangkat': parseFloat(emisiBerangkat.toFixed(2)),
        'EmisiPulang'   : parseFloat(emisiPulang.toFixed(2))
      };
    });

    return JSON.stringify(finalData);

  } catch (err) {
    Logger.log('Critical Error: ' + err.toString());
    return JSON.stringify({ error: err.toString() });
  }
}

// ─── GENERATE NARASI AI via Anthropic API ─────────────────────────────────────
// Pastikan API key sudah diset di Script Properties:
// Extensions > Apps Script > Project Settings > Script Properties
// Key: ANTHROPIC_API_KEY  |  Value: sk-ant-...
function generateNarasiAI(payload) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY belum diset di Script Properties');
  }

  var n         = payload.n         || 0;
  var tBiayaIDR = payload.tBiayaIDR || 0;
  var tE        = payload.tE        || 0;
  var periode   = payload.periode   || '';
  var avgDur    = payload.avgDur    || 0;
  var avgLead   = payload.avgLead   || 0;
  var avgSLA    = payload.avgSLA    || 0;
  var topProyek = payload.topProyek || [];
  var allProyek = payload.allProyek || [];
  var modaData  = payload.modaData  || [];
  var topDivisi = payload.topDivisi || [];

  // Format data untuk prompt
  var topProyekStr = topProyek.map(function(p, i) {
    return (i + 1) + '. ' + p.nama + ' (' + p.divisi + ', ' + p.trip + ' trip)';
  }).join('\n');

  var allProyekStr = allProyek.slice(0, 30).map(function(p, i) {
    return (i + 1) + '. ' + p.nama + ' | Divisi: ' + p.divisi + ' | ' + p.trip + ' trip';
  }).join('\n');

  var modaStr = modaData.map(function(m) {
    return '- ' + m.nama + ': ' + m.kg + ' kg CO2 (' + m.pct + '%, ' + m.times + ' kali)';
  }).join('\n');

  var topDivisiStr = topDivisi.map(function(d, i) {
    return (i + 1) + '. ' + d.nama + ' (' + d.trip + ' trip)';
  }).join('\n');

  var prompt =
    'Anda adalah asisten pelaporan PT. Penjaminan Infrastruktur Indonesia (PT PII Persero).\n' +
    'Buat laporan faktual, singkat, tanpa menilai kinerja.\n\n' +

    'DATA PERIODE ' + periode + ':\n' +
    '- Total perjalanan: ' + n + ' trip\n' +
    '- Total biaya: Rp ' + tBiayaIDR + ' Juta\n' +
    '- Rata-rata durasi: ' + avgDur + ' hari/trip\n' +
    '- Lead time rata-rata: ' + avgLead + ' hari\n' +
    '- SLA approve rata-rata: ' + avgSLA + ' jam\n' +
    '- Total emisi: ' + tE + ' kg CO2\n\n' +

    'DIVISI DENGAN PERJALANAN TERBANYAK:\n' + topDivisiStr + '\n\n' +

    '3 TUJUAN PERJALANAN TERBANYAK:\n' + topProyekStr + '\n\n' +
    'SEMUA TUJUAN PERJALANAN:\n' + allProyekStr + '\n\n' +
    'DATA MODA TRANSPORTASI:\n' + modaStr + '\n\n' +

    'Respons HARUS dalam format persis berikut (jangan tambah teks di luar tag):\n\n' +

    '[UMUM]\n' +
    'Tulis 1 paragraf (2-3 kalimat) berisi: total trip, total biaya, dan sebutkan divisi terbanyak berdasarkan data DIVISI DENGAN PERJALANAN TERBANYAK di atas (jangan ubah nama divisinya).\n\n' +

    '[PROYEK_JSON]\n' +
    'Dari daftar SEMUA TUJUAN PERJALANAN di atas, pilih maksimal 5 tujuan yang paling ' +
    'mencerminkan kegiatan proyek atau koordinasi strategis (rapat koordinasi, site visit, ' +
    'audiensi, monitoring, capacity building, dll). Urutkan berdasarkan jumlah trip terbanyak.\n' +
    'Kembalikan HANYA JSON array, tidak ada teks lain:\n' +
    '[{"nama":"nama tujuan perjalanan lengkap","divisi":"nama divisi","trip":N},...]\n' +
    'Jika tidak ada tujuan relevan, kembalikan: []\n\n' +

    '[SUSTAINABILITY]\n' +
    'Tulis 1 kalimat: total emisi karbon dan rata-rata per trip. ' +
    'Kemudian langsung JSON array moda transportasi:\n' +
    '[{"nama":"...","kg":N,"pct":N,"times":N},...]';

  var options = {
    method          : 'post',
    contentType     : 'application/json',
    headers         : {
      'x-api-key'          : apiKey,
      'anthropic-version'  : '2023-06-01'
    },
    payload         : JSON.stringify({
      model      : 'claude-sonnet-4-5',
      max_tokens : 1200,
      messages   : [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
  var code     = response.getResponseCode();

  if (code !== 200) {
    var errBody = response.getContentText().substring(0, 300);
    if (code === 529) throw new Error('Server AI sedang sibuk. Coba lagi dalam beberapa menit.');
    if (code === 401) throw new Error('API Key tidak valid. Periksa Script Properties.');
    if (code === 429) throw new Error('Batas penggunaan API tercapai. Coba lagi nanti.');
    throw new Error('API error ' + code + ': ' + errBody);
  }

  var result = JSON.parse(response.getContentText());
  return result.content[0].text;
}

// ─── HELPER: ISI KOORDINAT REF_KOTA OTOMATIS ─────────────────────────────────
function fillMissingCoordinates() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var refSheet = ss.getSheetByName('Ref_Kota');

  if (!refSheet) {
    SpreadsheetApp.getUi().alert("Error: Sheet bernama 'Ref_Kota' tidak ditemukan!");
    return;
  }

  var data = refSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var cityName = data[i][0];
    var lat      = data[i][1];
    var lng      = data[i][2];

    if (!lat || !lng) {
      try {
        var geo = Maps.newGeocoder().geocode(cityName);
        if (geo.status === 'OK') {
          var res = geo.results[0].geometry.location;
          refSheet.getRange(i + 1, 2).setValue(res.lat);
          refSheet.getRange(i + 1, 3).setValue(res.lng);
          Logger.log('Berhasil mengisi: ' + cityName);
        }
        Utilities.sleep(200);
      } catch (e) {
        Logger.log('Gagal mencari: ' + cityName);
      }
    }
  }

  SpreadsheetApp.getUi().alert('Proses Selesai! Silakan cek sheet Ref_Kota Anda.');
}
