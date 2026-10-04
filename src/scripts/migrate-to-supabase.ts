import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables. Create .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

interface LocalData {
  productos: any[]
  vendedores: any[]
  compradores: any[]
  ventasDiarias: any[]
  compras: any[]
  gastos: any[]
  impuestos: any[]
  configuracion: any
  movimientosCaja: any[]
  registrosIPVE: any[]
  pedidos: any[]
  solicitudesProductoNuevo: any[]
  salariosFijos: any[]
  fiados: any[]
}

async function loadLocalData(): Promise<LocalData> {
  const data: any = {}
  const tables = [
    'productos', 'vendedores', 'compradores', 'ventasDiarias', 'compras',
    'gastos', 'impuestos', 'configuracion', 'movimientosCaja', 'registrosIPVE',
    'pedidos', 'solicitudesProductoNuevo', 'salariosFijos', 'fiados'
  ]

  for (const table of tables) {
    try {
      const item = localStorage.getItem(table)
      data[table] = item ? JSON.parse(item) : []
    } catch {
      data[table] = []
    }
  }
  return data
}

async function migrate() {
  console.log('🚀 Iniciando migración de localStorage a Supabase...')

  // 1. Obtener usuario actual (owner)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('❌ No hay usuario autenticado. Inicia sesión primero en la app.')
    process.exit(1)
  }
  console.log('✅ Usuario owner:', user.email)

  // 2. Cargar datos locales
  const localData = await loadLocalData()
  console.log('📦 Datos locales cargados:', Object.keys(localData).map(k => `${k}: ${localData[k].length}`).join(', '))

  // 3. Crear negocio principal
  const businessName = localData.configuracion?.nombre || 'Mi Negocio Principal'
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .insert({
      nombre: businessName,
      slug: slug,
      nit: localData.configuracion?.nit || '',
      direccion: localData.configuracion?.direccion || '',
      telefono: localData.configuracion?.telefono || '',
      email: localData.configuracion?.email || '',
      regimen: localData.configuracion?.regimen || 'simplificado',
      tarifa_iva: localData.configuracion?.tarifaIva || 19,
      moneda: localData.configuracion?.moneda || 'COP',
      owner_id: user.id
    })
    .select()
    .single()

  if (bizError) {
    console.error('❌ Error creando negocio:', bizError)
    process.exit(1)
  }

  const businessId = business.id
  console.log('✅ Negocio creado:', businessName, '(', businessId, ')')

  // 4. Crear memberships para los 4 roles (virtuales)
  const roles = [
    { role: 'jefe', nombre: 'Jefe Principal', username: 'jefe', is_virtual: false, user_id: user.id },
    { role: 'admin', nombre: 'Administrador', username: 'admin', is_virtual: true, user_id: null },
    { role: 'comprador', nombre: 'Comprador', username: 'comprador', is_virtual: true, user_id: null },
    { role: 'vendedor', nombre: 'Vendedor', username: 'vendedor', is_virtual: true, user_id: null }
  ]

  for (const r of roles) {
    await supabase.from('memberships').insert({
      user_id: r.user_id,
      business_id: businessId,
      role: r.role,
      nombre: r.nombre,
      username: r.username,
      is_virtual: r.is_virtual
    })
  }
  console.log('✅ Membresías creadas para 4 roles')

  // 5. Configuración del negocio
  await supabase.from('configuracion_negocio').insert({
    business_id: businessId,
    nombre: businessName,
    nit: localData.configuracion?.nit || '',
    direccion: localData.configuracion?.direccion || '',
    telefono: localData.configuracion?.telefono || '',
    email: localData.configuracion?.email || '',
    regimen: localData.configuracion?.regimen || 'simplificado',
    tarifa_iva: localData.configuracion?.tarifaIva || 19,
    moneda: localData.configuracion?.moneda || 'COP'
  })

  // 6. Salarios fijos
  await supabase.from('salarios_fijos').insert([
    { business_id: businessId, rol: 'jefe', nombre: 'Jefe Principal', monto_semanal: 0 },
    { business_id: businessId, rol: 'admin', nombre: 'Administrador', monto_semanal: 0 },
    { business_id: businessId, rol: 'comprador', nombre: 'Comprador', monto_semanal: 0 },
    { business_id: businessId, rol: 'vendedor', nombre: 'Vendedor', monto_semanal: 0 }
  ])

  // 7. Migrar tablas con business_id
  const tablesWithBusinessId = [
    { table: 'productos', data: localData.productos, map: (d: any) => ({
      id: d.id, business_id: businessId, codigo: d.codigo, nombre: d.nombre,
      descripcion: d.descripcion, categoria: d.categoria, precio_compra: d.precioCompra,
      precio_venta: d.precioVenta, porcentaje_ganancia: d.porcentajeGanancia,
      stock: d.stock, stock_minimo: d.stockMinimo, unidad: d.unidad,
      fecha_registro: d.fechaRegistro, activo: d.activo
    })},
    { table: 'vendedores', data: localData.vendedores, map: (d: any) => ({
      id: d.id, business_id: businessId, nombre: d.nombre, activo: d.activo,
      fecha_registro: d.fechaRegistro
    })},
    { table: 'compradores', data: localData.compradores, map: (d: any) => ({
      id: d.id, business_id: businessId, nombre: d.nombre, activo: d.activo,
      fecha_registro: d.fechaRegistro
    })},
    { table: 'ventas_diarias', data: localData.ventasDiarias, map: (d: any) => ({
      id: d.id, business_id: businessId, fecha: d.fecha, vendedor_id: d.vendedorId,
      vendedor_nombre: d.vendedorNombre, monto_efectivo: d.montoEfectivo,
      monto_transferencia: d.montoTransferencia, salario_calculado: d.salarioCalculado,
      notas: d.notas
    })},
    { table: 'compras', data: localData.compras, map: (d: any) => ({
      id: d.id, business_id: businessId, fecha: d.fecha, comprador_id: d.compradorId,
      comprador_nombre: d.compradorNombre, subtotal: d.subtotal, total: d.total,
      metodo_pago: d.metodoPago, estado: d.estado, notas: d.notas
    })},
    { table: 'gastos', data: localData.gastos, map: (d: any) => ({
      id: d.id, business_id: businessId, fecha: d.fecha, concepto: d.concepto,
      categoria: d.categoria, monto: d.monto, metodo_pago: d.metodoPago,
      descripcion: d.descripcion
    })},
    { table: 'impuestos', data: localData.impuestos, map: (d: any) => ({
      id: d.id, business_id: businessId, nombre: d.nombre, tipo: d.tipo,
      periodo: d.periodo, fecha_vencimiento: d.fechaVencimiento,
      monto: d.monto, monto_pagado: d.montoPagado, estado: d.estado, notas: d.notas
    })},
    { table: 'movimientos_caja', data: localData.movimientosCaja, map: (d: any) => ({
      id: d.id, business_id: businessId, fecha: d.fecha, tipo: d.tipo,
      concepto: d.concepto, monto: d.monto, categoria: d.categoria,
      metodo_pago: d.metodoPago
    })},
    { table: 'registros_ipve', data: localData.registrosIPVE, map: (d: any) => ({
      id: d.id, business_id: businessId, fecha: d.fecha, vendedor_id: d.vendedorId,
      vendedor_nombre: d.vendedorNombre, producto_id: d.productoId,
      producto_nombre: d.productoNombre, inicio: d.inicio, entrada: d.entrada,
      final: d.final, precio_venta: d.precioVenta, tipo: d.tipo
    })},
    { table: 'pedidos', data: localData.pedidos, map: (d: any) => ({
      id: d.id, business_id: businessId, fecha: d.fecha, vendedor_id: d.vendedorId,
      vendedor_nombre: d.vendedorNombre, producto_id: d.productoId,
      producto_nombre: d.productoNombre, cantidad: d.cantidad,
      cantidad_entregada: d.cantidadEntregada, estado: d.estado, notas: d.notas
    })},
    { table: 'solicitudes_producto_nuevo', data: localData.solicitudesProductoNuevo, map: (d: any) => ({
      id: d.id, business_id: businessId, fecha: d.fecha, comprador_id: d.compradorId,
      comprador_nombre: d.compradorNombre, nombre_producto: d.nombreProducto,
      precio_compra: d.precioCompra, cantidad: d.cantidad, estado: d.estado,
      notas: d.notas, precio_venta: d.precioVenta, stock_minimo: d.stockMinimo,
      producto_id: d.productoId, comentario_admin: d.comentarioAdmin
    })},
    { table: 'fiados', data: localData.fiados, map: (d: any) => ({
      id: d.id, business_id: businessId, fecha: d.fecha, cliente_nombre: d.clienteNombre,
      vendedor_id: d.vendedorId, vendedor_nombre: d.vendedorNombre,
      monto: d.monto, descripcion: d.descripcion, notas: d.notas,
      estado: d.estado, fecha_cobro: d.fechaCobro
    })}
  ]

  for (const { table, data, map } of tablesWithBusinessId) {
    if (data.length > 0) {
      const mapped = data.map(map)
      const { error } = await supabase.from(table).insert(mapped)
      if (error) {
        console.error(`❌ Error migrando ${table}:`, error.message)
      } else {
        console.log(`✅ ${table}: ${data.length} registros migrados`)
      }
    }
  }

  // 8. Migrar detalles_compra (requiere compras migradas primero)
  if (localData.compras.length > 0) {
    const detalles: any[] = []
    for (const compra of localData.compras) {
      if (compra.detalles && compra.detalles.length > 0) {
        for (const det of compra.detalles) {
          detalles.push({
            compra_id: compra.id,
            producto_id: det.productoId,
            producto_nombre: det.productoNombre,
            cantidad: det.cantidad,
            precio_unitario: det.precioUnitario
          })
        }
      }
    }
    if (detalles.length > 0) {
      const { error } = await supabase.from('detalles_compra').insert(detalles)
      if (error) console.error('❌ Error migrando detalles_compra:', error.message)
      else console.log(`✅ detalles_compra: ${detalles.length} registros migrados`)
    }
  }

  console.log('\n🎉 Migración completada!')
  console.log(`📋 Business ID: ${businessId}`)
  console.log(`🔑 Credenciales por defecto:`)
  console.log(`   Jefe: email (tu cuenta) / password`)
  console.log(`   Admin: admin / admin123`)
  console.log(`   Comprador: comprador / comprador123`)
  console.log(`   Vendedor: vendedor / vendedor123`)
}

// Ejecutar solo en entorno browser (console)
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.migrateLocalToSupabase = migrate
  console.log('Ejecutar migrateLocalToSupabase() en la consola del navegador')
} else {
  // Node.js - requiere localStorage mock o archivo JSON
  console.log('Este script debe ejecutarse en el navegador (F12 console)')
  console.log('O crea un archivo JSON con tus datos y usa la versión Node')
}

export { migrate }