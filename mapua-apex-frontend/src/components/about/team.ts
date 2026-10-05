import AgathaPhoto from "@/assets/Agatha.png"
import AvielPhoto from "@/assets/Aviel.png"
import BeaPhoto from "@/assets/Bea.png"
import BenedictPhoto from "@/assets/Benedict.png"
import JedrickPhoto from "@/assets/Jedrick.png"
import JoelPhoto from "@/assets/Joel.png"
import KarinaPhoto from "@/assets/Karina.png"
import LunaPhoto from "@/assets/Luna.png"
import MicoPhoto from "@/assets/Mico.png"
import NigelPhoto from "@/assets/Nigel.png"
import NicolePhoto from "@/assets/Nicole.png"
import RyanPhoto from "@/assets/Ryan.png"

export type TeamMember = {
  name: string
  coorole: string
  awsrole: string
  photo: string
}

export const TEAM_MEMBERS: TeamMember[] = [
  { name: "Jedrick", coorole: "Organization's Welfare and Advocacy Committee 25-26", awsrole: "Chief Executive Officer 26-27", photo: JedrickPhoto },
  { name: "Nigel", coorole: "External Relations Co-Head 25-26", awsrole: "Chief Operations Officer: 26-27", photo: NigelPhoto },
  { name: "Mico", coorole: "", awsrole: "Corporate Secretary: 26-27", photo: MicoPhoto },
  { name: "Ryan", coorole: "Organization's Welfare and Advocacy Head 25-26", awsrole: "Chief Technology Officer: 26-27", photo: RyanPhoto },
  { name: "Agatha", coorole: "", awsrole: "Chief People Officer: 26-27", photo: AgathaPhoto },
  { name: "Bea", coorole: "Creatives Committee 25-26", awsrole: "Chief Communications Officer: 26-27", photo: BeaPhoto },
  { name: "Nicole", coorole: "Organization's Welfare and Advocacy Co-Head 25-26", awsrole: "Chief Finance Officer: 26-27", photo: NicolePhoto },
  { name: "Karina", coorole: "External Relations Co-Head 25-26",awsrole: "Chief Auditing Officer: 26-27", photo: KarinaPhoto },
  { name: "Aviel", coorole: "External Relations Head 25-26", awsrole: "Chief External Relations Officer: 26-27", photo: AvielPhoto },
  { name: "Benedict", coorole: "President 25-26", awsrole: "Chief Community Relations Officer: 26-27", photo: BenedictPhoto },
  { name: "Joel", coorole: "", awsrole: "Technology Committee: 26-27", photo: JoelPhoto },
  { name: "Luna", coorole: "", awsrole: "AWS-SBG Arcus: 26-27", photo: LunaPhoto },
]

export const TECH_STACK = [
  { name: "React", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { name: "TypeScript", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "React Router (Data Mode)", color: "bg-violet-50 text-violet-700 border-violet-200" },
  { name: "Tailwind CSS", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { name: "Coss UI", color: "bg-neutral-100 text-neutral-700 border-neutral-300" },
  { name: "Zustand", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { name: "AWS SES", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { name: "AWS Cognito", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { name: "AWS DynamoDB", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { name: "AWS Lambda", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
]
