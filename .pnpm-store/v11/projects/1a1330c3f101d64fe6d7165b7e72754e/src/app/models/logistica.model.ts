import { ChoferMedium } from "./chofer.model";
import { Camion, Semirremolque } from "./vehiculo.model";

export interface Logistica {
    id:           number;
    chofer:       ChoferMedium;
    conjunto_veh: ConjuntoVeh;
    fecha_arribo: Date;
    km_arribo:    number;
    fecha_fin:    null;
    km_fin:       null;
    disponible:   boolean;
    activo:       boolean;
}

export interface ConjuntoVeh {
    id:                number;
    camiones:          Camion;
    semi1:             Semirremolque;
    semi2:             Semirremolque | null;
    fecha_enganche:    Date | null;
    km_enganche:       number;
    fecha_desenganche: Date | null;
    km_desenganche:    Date | null;
    categoria:         Categoria;
    disponible:        boolean;
    activo:            boolean;
}

export interface Categoria {
    id:      number;
    nombre:  string;
    cap_max: string;
    is_bitren: boolean;
}

export interface FormDataEnganche {
    camiones: number;
    semi1: number;
    semi2: number;
    categoria: number;
    fecha_enganche: Date;
    km_enganche: number;
    actualiza_odometro: boolean;
}