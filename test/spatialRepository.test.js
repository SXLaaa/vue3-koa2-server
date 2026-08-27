const test = require('node:test')
const assert = require('node:assert/strict')

function recordingClient(rows = []) {
  const calls = []
  return {
    calls,
    query: async (text, values) => {
      calls.push({ text, values })
      return { rows }
    }
  }
}

test('相交查询通过 ST_Intersects 与参数筛选农业要素', async () => {
  const { createSpatialRepository } = require('../repositories/spatialRepository')
  const client = recordingClient([{ feature_id: 9 }])
  const repository = createSpatialRepository(client)

  assert.deepEqual(await repository.findIntersections({ regionCode: '370200', featureType: 'wheat' }), [{ feature_id: 9 }])
  assert.match(client.calls[0].text, /ST_Intersects\s*\(/i)
  assert.deepEqual(client.calls[0].values, ['370200', 'wheat'])
  assert.equal(client.calls[0].text.includes('370200'), false)
})

test('包含查询使用 ST_Within 且不拼接要素编号', async () => {
  const { createSpatialRepository } = require('../repositories/spatialRepository')
  const client = recordingClient([{ contained: true }])
  const repository = createSpatialRepository(client)

  assert.equal(await repository.isFeatureWithinRegion({ featureId: 88, regionCode: '370200' }), true)
  assert.match(client.calls[0].text, /ST_Within\s*\(/i)
  assert.deepEqual(client.calls[0].values, [88, '370200'])
  assert.equal(client.calls[0].text.includes('88'), false)
})

test('面积统计使用 ST_Intersection 且转换 geography 计算椭球面积', async () => {
  const { createSpatialRepository } = require('../repositories/spatialRepository')
  const client = recordingClient([{ feature_count: '2', area_square_meters: '123.45' }])
  const repository = createSpatialRepository(client)

  assert.deepEqual(await repository.calculateIntersectionArea({ regionCode: '370200', featureType: 'corn' }), {
    featureCount: 2,
    areaSquareMeters: 123.45
  })
  assert.match(client.calls[0].text, /ST_Intersection\s*\(/i)
  assert.match(client.calls[0].text, /ST_Area\s*\([^;]*::geography\s*\)/is)
  assert.deepEqual(client.calls[0].values, ['370200', 'corn'])
})
