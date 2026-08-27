function parseRows(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (character === '"') quoted = false
      else value += character
    } else if (character === '"') quoted = true
    else if (character === ',') {
      row.push(value)
      value = ''
    } else if (character === '\n') {
      row.push(value.replace(/\r$/u, ''))
      rows.push(row)
      row = []
      value = ''
    } else value += character
  }
  if (quoted) throw new Error('CSV 存在未闭合的引号')
  if (value || row.length) {
    row.push(value.replace(/\r$/u, ''))
    rows.push(row)
  }
  return rows.filter((item) => item.some((cell) => cell.trim() !== ''))
}

function bboxGeometry(record) {
  const minLon = Number(record.min_lon)
  const minLat = Number(record.min_lat)
  const maxLon = Number(record.max_lon)
  const maxLat = Number(record.max_lat)
  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) {
    throw new Error('CSV 必须提供有效的 min_lon/min_lat/max_lon/max_lat')
  }
  if (minLon >= maxLon || minLat >= maxLat) throw new Error('CSV 边界框最小值必须小于最大值')
  return {
    type: 'Polygon',
    coordinates: [[
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ]],
  }
}

// CSV 模板使用显式边界框，避免在无 GIS 依赖的 dry-run 中模糊解析 WKT。
export function csvToFeatures(text) {
  const rows = parseRows(text)
  if (rows.length < 2) throw new Error('CSV 至少需要表头和一条数据')
  const headers = rows[0].map((header) => header.trim())
  if (new Set(headers).size !== headers.length) throw new Error('CSV 表头不能重复')
  return rows.slice(1).map((cells, rowIndex) => {
    if (cells.length !== headers.length) throw new Error(`CSV 第 ${rowIndex + 2} 行列数与表头不一致`)
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index]]))
    return {
      type: 'Feature',
      id: record.source_id || undefined,
      properties: record,
      geometry: bboxGeometry(record),
    }
  })
}
