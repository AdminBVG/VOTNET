import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { AuthGuard } from './services/auth.guard';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'users',
    loadChildren: () => import('./user-admin/user-admin.module').then(m => m.UserAdminModule),
    canLoad: [AuthGuard],
    data: { roles: ['GlobalAdmin', 'VoteAdmin'] }
  },
  {
    path: 'elections',
    loadChildren: () => import('./elections/elections.module').then(m => m.ElectionsModule),
    canLoad: [AuthGuard]
  },
  { path: '', redirectTo: 'elections', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
