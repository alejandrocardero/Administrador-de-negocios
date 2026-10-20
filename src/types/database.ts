export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          nombre: string
          slug: string
          nit: string | null
          direccion: string | null
          telefono: string | null
          email: string | null
          regimen: string
          tarifa_iva: number
          moneda: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          slug: string
          nit?: string | null
          direccion?: string | null
          telefono?: string | null
          email?: string | null
          regimen?: string
          tarifa_iva?: number
          moneda?: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          slug?: string
          nit?: string | null
          direccion?: string | null
          telefono?: string | null
          email?: string | null
          regimen?: string
          tarifa_iva?: number
          moneda?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          id: string
          user_id: string | null
          business_id: string
          role: 'jefe' | 'admin' | 'comprador' | 'vendedor'
          nombre: string
          username: string
          is_virtual: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          business_id: string
          role: 'jefe' | 'admin' | 'comprador' | 'vendedor'
          nombre: string
          username: string
          is_virtual?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          business_id?: string
          role?: 'jefe' | 'admin' | 'comprador' | 'vendedor'
          nombre?: string
          username?: string
          is_virtual?: boolean
          created_at?: string
        }
        Relationships: []
      }
      productos: {
        Row: {
          id: string
          business_id: string
          codigo: string
          nombre: string
          descripcion: string | null
          categoria: 'aseo' | 'comida' | 'bebidas' | 'cerveza' | 'otros'
          precio_compra: number
          precio_venta: number
          porcentaje_ganancia: number
          stock: number
          stock_minimo: number
          unidad: string
          fecha_registro: string
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          codigo: string
          nombre: string
          descripcion?: string | null
          categoria: 'aseo' | 'comida' | 'bebidas' | 'cerveza' | 'otros'
          precio_compra: number
          precio_venta: number
          porcentaje_ganancia: number
          stock: number
          stock_minimo: number
          unidad: string
          fecha_registro?: string
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          codigo?: string
          nombre?: string
          descripcion?: string | null
          categoria?: 'aseo' | 'comida' | 'bebidas' | 'cerveza' | 'otros'
          precio_compra?: number
          precio_venta?: number
          porcentaje_ganancia?: number
          stock?: number
          stock_minimo?: number
          unidad?: string
          fecha_registro?: string
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendedores: {
        Row: {
          id: string
          business_id: string
          nombre: string
          activo: boolean
          fecha_registro: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          nombre: string
          activo?: boolean
          fecha_registro?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          nombre?: string
          activo?: boolean
          fecha_registro?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      compradores: {
        Row: {
          id: string
          business_id: string
          nombre: string
          activo: boolean
          fecha_registro: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          nombre: string
          activo?: boolean
          fecha_registro?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          nombre?: string
          activo?: boolean
          fecha_registro?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ventas_diarias: {
        Row: {
          id: string
          business_id: string
          fecha: string
          vendedor_id: string
          vendedor_nombre: string
          monto_efectivo: number
          monto_transferencia: number
          total_vendido: number
          salario_calculado: number
          diferencia_caja: number | null
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          fecha: string
          vendedor_id: string
          vendedor_nombre: string
          monto_efectivo: number
          monto_transferencia: number
          salario_calculado: number
          diferencia_caja?: number | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          fecha?: string
          vendedor_id?: string
          vendedor_nombre?: string
          monto_efectivo?: number
          monto_transferencia?: number
          salario_calculado?: number
          diferencia_caja?: number | null
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      compras: {
        Row: {
          id: string
          business_id: string
          fecha: string
          comprador_id: string
          comprador_nombre: string
          subtotal: number
          total: number
          metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'credito'
          estado: 'completada' | 'pendiente' | 'cancelada'
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          fecha: string
          comprador_id: string
          comprador_nombre: string
          subtotal: number
          total: number
          metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'credito'
          estado?: 'completada' | 'pendiente' | 'cancelada'
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          fecha?: string
          comprador_id?: string
          comprador_nombre?: string
          subtotal?: number
          total?: number
          metodo_pago?: 'efectivo' | 'tarjeta' | 'transferencia' | 'credito'
          estado?: 'completada' | 'pendiente' | 'cancelada'
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      detalles_compra: {
        Row: {
          id: string
          compra_id: string
          producto_id: string
          producto_nombre: string
          cantidad: number
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          id?: string
          compra_id: string
          producto_id: string
          producto_nombre: string
          cantidad: number
          precio_unitario: number
        }
        Update: {
          id?: string
          compra_id?: string
          producto_id?: string
          producto_nombre?: string
          cantidad?: number
          precio_unitario?: number
        }
        Relationships: []
      }
      gastos: {
        Row: {
          id: string
          business_id: string
          fecha: string
          concepto: string
          categoria: 'servicios' | 'nomina' | 'arriendo' | 'impuestos' | 'mantenimiento' | 'otros'
          monto: number
          metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia'
          descripcion: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          fecha: string
          concepto: string
          categoria: 'servicios' | 'nomina' | 'arriendo' | 'impuestos' | 'mantenimiento' | 'otros'
          monto: number
          metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia'
          descripcion?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          fecha?: string
          concepto?: string
          categoria?: 'servicios' | 'nomina' | 'arriendo' | 'impuestos' | 'mantenimiento' | 'otros'
          monto?: number
          metodo_pago?: 'efectivo' | 'tarjeta' | 'transferencia'
          descripcion?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      impuestos: {
        Row: {
          id: string
          business_id: string
          nombre: string
          tipo: 'iva' | 'renta' | 'ica' | 'otro' | 'onat' | 'deposito_bancario'
          periodo: string
          fecha_vencimiento: string
          monto: number
          monto_pagado: number
          estado: 'pendiente' | 'pagado' | 'vencido'
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          nombre: string
          tipo: 'iva' | 'renta' | 'ica' | 'otro' | 'onat' | 'deposito_bancario'
          periodo: string
          fecha_vencimiento: string
          monto: number
          monto_pagado?: number
          estado?: 'pendiente' | 'pagado' | 'vencido'
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          nombre?: string
          tipo?: 'iva' | 'renta' | 'ica' | 'otro' | 'onat' | 'deposito_bancario'
          periodo?: string
          fecha_vencimiento?: string
          monto?: number
          monto_pagado?: number
          estado?: 'pendiente' | 'pagado' | 'vencido'
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      configuracion_negocio: {
        Row: {
          business_id: string
          nombre: string
          nit: string | null
          direccion: string | null
          telefono: string | null
          email: string | null
          regimen: string
          tarifa_iva: number
          moneda: string
          created_at: string
          updated_at: string
        }
        Insert: {
          business_id: string
          nombre: string
          nit?: string | null
          direccion?: string | null
          telefono?: string | null
          email?: string | null
          regimen?: string
          tarifa_iva?: number
          moneda?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          nombre?: string
          nit?: string | null
          direccion?: string | null
          telefono?: string | null
          email?: string | null
          regimen?: string
          tarifa_iva?: number
          moneda?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimientos_caja: {
        Row: {
          id: string
          business_id: string
          fecha: string
          tipo: 'entrada' | 'salida'
          concepto: string
          monto: number
          categoria: string
          metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia'
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          fecha: string
          tipo: 'entrada' | 'salida'
          concepto: string
          monto: number
          categoria: string
          metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia'
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          fecha?: string
          tipo?: 'entrada' | 'salida'
          concepto?: string
          monto?: number
          categoria?: string
          metodo_pago?: 'efectivo' | 'tarjeta' | 'transferencia'
          created_at?: string
        }
        Relationships: []
      }
      registros_ipve: {
        Row: {
          id: string
          business_id: string
          fecha: string
          vendedor_id: string
          vendedor_nombre: string
          producto_id: string
          producto_nombre: string
          inicio: number
          entrada: number
          final: number
          precio_venta: number
          tipo: 'diario' | 'historico'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          fecha: string
          vendedor_id: string
          vendedor_nombre: string
          producto_id: string
          producto_nombre: string
          inicio: number
          entrada: number
          final: number
          precio_venta: number
          tipo: 'diario' | 'historico'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          fecha?: string
          vendedor_id?: string
          vendedor_nombre?: string
          producto_id?: string
          producto_nombre?: string
          inicio?: number
          entrada?: number
          final?: number
          precio_venta?: number
          tipo?: 'diario' | 'historico'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          id: string
          business_id: string
          fecha: string
          vendedor_id: string
          vendedor_nombre: string
          producto_id: string
          producto_nombre: string
          cantidad: number
          cantidad_entregada: number | null
          estado: 'pendiente' | 'aprobado' | 'entregado' | 'cancelado'
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          fecha?: string
          vendedor_id: string
          vendedor_nombre: string
          producto_id: string
          producto_nombre: string
          cantidad: number
          cantidad_entregada?: number | null
          estado?: 'pendiente' | 'aprobado' | 'entregado' | 'cancelado'
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          fecha?: string
          vendedor_id?: string
          vendedor_nombre?: string
          producto_id?: string
          producto_nombre?: string
          cantidad?: number
          cantidad_entregada?: number | null
          estado?: 'pendiente' | 'aprobado' | 'entregado' | 'cancelado'
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      solicitudes_producto_nuevo: {
        Row: {
          id: string
          business_id: string
          fecha: string
          comprador_id: string
          comprador_nombre: string
          nombre_producto: string
          precio_compra: number
          cantidad: number
          estado: 'pendiente' | 'aprobada' | 'rechazada'
          notas: string | null
          precio_venta: number | null
          stock_minimo: number | null
          producto_id: string | null
          comentario_admin: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          fecha?: string
          comprador_id: string
          comprador_nombre: string
          nombre_producto: string
          precio_compra: number
          cantidad: number
          estado?: 'pendiente' | 'aprobada' | 'rechazada'
          notas?: string | null
          precio_venta?: number | null
          stock_minimo?: number | null
          producto_id?: string | null
          comentario_admin?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          fecha?: string
          comprador_id?: string
          comprador_nombre?: string
          nombre_producto?: string
          precio_compra?: number
          cantidad?: number
          estado?: 'pendiente' | 'aprobada' | 'rechazada'
          notas?: string | null
          precio_venta?: number | null
          stock_minimo?: number | null
          producto_id?: string | null
          comentario_admin?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      salarios_fijos: {
        Row: {
          id: string
          business_id: string
          rol: 'jefe' | 'admin' | 'comprador' | 'vendedor'
          nombre: string
          monto_semanal: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          rol: 'jefe' | 'admin' | 'comprador' | 'vendedor'
          nombre: string
          monto_semanal: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          rol?: 'jefe' | 'admin' | 'comprador' | 'vendedor'
          nombre?: string
          monto_semanal?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fiados: {
        Row: {
          id: string
          business_id: string
          fecha: string
          cliente_nombre: string
          vendedor_id: string
          vendedor_nombre: string
          monto: number
          descripcion: string | null
          notas: string | null
          estado: 'pendiente' | 'cobrado'
          fecha_cobro: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          fecha: string
          cliente_nombre: string
          vendedor_id: string
          vendedor_nombre: string
          monto: number
          descripcion?: string | null
          notas?: string | null
          estado?: 'pendiente' | 'cobrado'
          fecha_cobro?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          fecha?: string
          cliente_nombre?: string
          vendedor_id?: string
          vendedor_nombre?: string
          monto?: number
          descripcion?: string | null
          notas?: string | null
          estado?: 'pendiente' | 'cobrado'
          fecha_cobro?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      onboard_business: {
        Args: {
          p_nombre: string
          p_slug: string
          p_nit: string | null
          p_direccion: string | null
          p_telefono: string | null
          p_email: string | null
          p_regimen: string | null
          p_tarifa_iva: number | null
          p_moneda: string | null
          p_jefe_nombre: string
          p_jefe_email: string
          p_jefe_password: string
          p_roles_json: Json
        }
        Returns: {
          business_id: string
          business_nombre: string
          owner_id: string
          credentials: Json
        }
      }
      get_user_memberships: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          business_id: string
          business_nombre: string
          business_slug: string
          role: string
          nombre: string
          username: string
          is_virtual: boolean
          is_owner: boolean
        }[]
      }
      list_businesses_for_login: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          nombre: string
          slug: string
        }[]
      }
      update_updated_at_column: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      user_role: 'jefe' | 'admin' | 'comprador' | 'vendedor'
      categoria_producto: 'aseo' | 'comida' | 'bebidas' | 'cerveza' | 'otros'
      regimen_fiscal: 'simplificado' | 'comun'
      metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'credito'
      estado_compra: 'completada' | 'pendiente' | 'cancelada'
      categoria_gasto: 'servicios' | 'nomina' | 'arriendo' | 'impuestos' | 'mantenimiento' | 'otros'
      tipo_impuesto: 'iva' | 'renta' | 'ica' | 'otro'
      estado_impuesto: 'pendiente' | 'pagado' | 'vencido'
      tipo_movimiento: 'entrada' | 'salida'
      tipo_registro_ipve: 'diario' | 'historico'
      estado_pedido: 'pendiente' | 'aprobado' | 'entregado' | 'cancelado'
      estado_solicitud: 'pendiente' | 'aprobada' | 'rechazada'
      estado_fiado: 'pendiente' | 'cobrado'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row']

export type TablesInsert<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Insert']

export type TablesUpdate<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Update']

export type Enums<EnumName extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][EnumName]
