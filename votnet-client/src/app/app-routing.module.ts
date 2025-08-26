import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'users',
    loadChildren: () => import('./user-admin/user-admin.module').then(m => m.UserAdminModule)
  },
  {
    path: 'elections',
    loadChildren: () => import('./elections/elections.module').then(m => m.ElectionsModule)
  },
  { path: '', redirectTo: 'elections', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
