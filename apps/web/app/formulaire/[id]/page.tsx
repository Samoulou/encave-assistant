import PublicForm from './public-form';
export const metadata={title:'Demander une visite — EnCave Assistant',description:'Transmettez votre demande à la cave, sans créer de compte.'};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PublicForm key={id} id={id}/>;}
