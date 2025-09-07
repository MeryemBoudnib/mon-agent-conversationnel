import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type UserRole = 'USER'|'ADMIN';
export interface User { id: number; email: string; role: UserRole; active?: boolean; }
export interface Page<T> {
  content: T[]; totalElements: number; totalPages: number; number: number; size: number;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private base = '/api/users';

  search(opts: {
    page?: number; size?: number; sort?: string; dir?: 'asc'|'desc';
    q?: string; role?: ''|'USER'|'ADMIN';
  }): Observable<Page<User>> {
    let p = new HttpParams()
      .set('page', String(opts.page ?? 0))
      .set('size', String(opts.size ?? 25))
      .set('sort', String(opts.sort ?? 'id'))
      .set('dir',  String(opts.dir ?? 'asc'));
    if (opts.q)    p = p.set('q', opts.q);
    if (opts.role) p = p.set('role', opts.role);
    return this.http.get<Page<User>>(this.base, { params: p });
  }

  toggleActive(id: number, active: boolean) {
    return this.http.patch(`${this.base}/${id}/active`, { active });
  }

  delete(id: number) {
    return this.http.delete(`${this.base}/${id}`);
  }
}
